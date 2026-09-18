import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";
import type { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { validateIri } from "validate-iri";
import { ensureLabelColumn, groupCsv } from "./catalog-transform";

export const RESERVED_COLUMNS = new Set(["search_text", "search_vector"]);
const REQUIRED_COLUMNS = new Set(["iri", "label"]);
class DuplicateCatalogIrisError extends Error {}

export function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function validateHeaders(record: string[]): string[] {
  const columns = record.map((column) => column.trim());
  if (columns.length === 0) {
    throw new Error("CSV has no columns");
  }

  if (columns.some((column) => column.length === 0)) {
    throw new Error(
      "CSV contains an empty column name"
    );
  }

  for (const required of REQUIRED_COLUMNS) {
    if (!columns.includes(required)) {
      throw new Error(
        `CSV must contain required column '${required}'`
      );
    }
  }

  if (new Set(columns).size !== columns.length) {
    throw new Error(
      "CSV contains duplicate column names"
    );
  }

  for (const column of columns) {
    if (RESERVED_COLUMNS.has(column)) {
      throw new Error(
        `'${column}' is reserved and cannot be used as a CSV column`
      );
    }
  }

  return columns;
}

// The caller owns the transaction. Only these staged rows may be seeded after
// validation succeeds; ON COMMIT DROP and rollback both clean up the table.
export async function validateCatalog(client: Client, csvPath: string) {
  await ensureLabelColumn(csvPath);
  await client.query("SAVEPOINT catalog_validation");
  try {
    const result = await validateCatalogOnce(client, csvPath);
    await client.query("RELEASE SAVEPOINT catalog_validation");
    return result;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT catalog_validation");
    await client.query("RELEASE SAVEPOINT catalog_validation");
    if (!(error instanceof DuplicateCatalogIrisError)) throw error;
    console.log("CSV contains duplicate IRIs; grouping values by iri and retrying validation once.");
    await groupCsv(csvPath, csvPath, "iri");
    return validateCatalogOnce(client, csvPath);
  }
}

async function validateCatalogOnce(client: Client, csvPath: string) {
  let columns: string[] = [];
  let rows = 0;
  await pipeline(
    fs.createReadStream(csvPath),
    parse({ bom: true }),
    async (records: AsyncIterable<string[]>) => {
      const iterator = records[Symbol.asyncIterator]();
      const header = await iterator.next();
      if (header.done) throw new Error("CSV is empty");
      columns = validateHeaders(header.value);
      const iriIndex = columns.indexOf("iri");
      await client.query(`
        CREATE TEMP TABLE graphpeek_import (
          ${columns.map((column) => `${quoteIdentifier(column)} text${column === "iri" ? " PRIMARY KEY" : ""}`).join(", ")}
        ) ON COMMIT DROP
      `);

      async function* validatedRows() {
        for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
          const record = next.value;
          rows++;
          const error = validateIri(record[iriIndex]);
          if (error) {
            throw new Error(`CSV record ${rows + 1}: invalid IRI ${JSON.stringify(record[iriIndex])}`, { cause: error });
          }
          // Re-encode parsed fields so COPY imports exactly what was validated,
          // including quoted commas, embedded newlines, and a stripped BOM.
          yield record.map((value) => `"${value.replaceAll('"', '""')}"`).join(",") + "\n";
        }
      }

      try {
        await pipeline(
          Readable.from(validatedRows()),
          client.query(copyFrom(`COPY graphpeek_import (${columns.map(quoteIdentifier).join(", ")}) FROM STDIN WITH (FORMAT CSV)`))
        );
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          throw new DuplicateCatalogIrisError("CSV contains duplicate IRIs", { cause: error });
        }
        throw error;
      }
    }
  );
  return { columns, rows };
}
