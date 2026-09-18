import { existsSync } from "node:fs";
import { chown, mkdir, mkdtemp, open, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

function validateQuery(query: string): string {
  // Skip declarations only when checking the query form; preserve the original text.
  const gap = String.raw`(?:\s|#[^\r\n]*(?:\r?\n|$))*`;
  const declaration = new RegExp(`^${gap}(?:BASE${gap}<[^>]*>|PREFIX\\s+[^\\s:]*:${gap}<[^>]*>)`, "i");
  let body = query;
  let match: RegExpMatchArray | null;
  while ((match = body.match(declaration))) {
    body = body.slice(match[0].length);
  }
  if (!new RegExp(`^${gap}SELECT\\b`, "i").test(body)) {
    throw new Error("create-catalog.sparql must contain a SELECT query.");
  }
  return query;
}

function readColumns(result: unknown): string[] {
  if (!result || typeof result !== "object" || !("head" in result)
    || !result.head || typeof result.head !== "object" || !("vars" in result.head)
    || !Array.isArray(result.head.vars)
    || !result.head.vars.every((column): column is string => typeof column === "string" && column.length > 0)) {
    throw new Error("SELECT did not return SPARQL JSON variable names");
  }
  const columns = result.head.vars;
  if (!columns.includes("iri") || new Set(columns).size !== columns.length) {
    throw new Error("Catalog SELECT must return unique columns including ?iri.");
  }
  // The importer expects the IRI in the first column.
  return ["iri", ...columns.filter((column) => column !== "iri")];
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

type Binding = { type: string; value: string };

function readRows(result: unknown, columns: string[]): Record<string, Binding>[] {
  if (!result || typeof result !== "object" || !("results" in result)
    || !result.results || typeof result.results !== "object"
    || !("bindings" in result.results) || !Array.isArray(result.results.bindings)) {
    throw new Error("SELECT did not return SPARQL JSON bindings");
  }
  for (const row of result.results.bindings) {
    if (!row || typeof row !== "object") throw new Error("Invalid SELECT row");
    for (const column of columns) {
      const binding = row[column];
      if (column !== "iri" && binding === undefined) continue;
      if (!binding || typeof binding.value !== "string" || typeof binding.type !== "string") {
        throw new Error(`SELECT row has no valid ${column} binding`);
      }
    }
    if (row.iri.type !== "uri") throw new Error("SELECT row has no IRI subject");
  }
  return result.results.bindings;
}

function parseOptions() {
  const { values, positionals } = parseArgs({
    options: {
      "page-size": { type: "string" },
      "max-rows": { type: "string" },
      "max-file-size": { type: "string" },
      "file-size": { type: "string" },
    },
    allowPositionals: true,
  });
  if (positionals.length > 2 || (values["page-size"] !== undefined && positionals.length > 0)
    || (values["max-file-size"] !== undefined && values["file-size"] !== undefined)
    || (positionals.length > 1 && (values["max-file-size"] !== undefined || values["file-size"] !== undefined))) {
    throw new Error("Use --page-size <rows> --max-file-size <bytes|10MB|null>, or positional <page-size> [size].");
  }
  const rawPageSize = values["page-size"] ?? positionals[0] ?? "1000";
  const pageSize = Number(rawPageSize);
  if (!/^[1-9]\d*$/.test(rawPageSize) || !Number.isSafeInteger(pageSize)) {
    throw new Error("--page-size must be a positive safe integer (default: 1000).");
  }
  const rawSize = values["max-file-size"] ?? values["file-size"] ?? positionals[1] ?? "null";
  let maxFileSize: number | null = null;
  if (rawSize.toLowerCase() !== "null") {
    const match = /^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|KiB|MiB|GiB)?$/i.exec(rawSize);
    const units: Record<string, number> = { b: 1, kb: 1000, mb: 1e6, gb: 1e9, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3 };
    maxFileSize = match ? Number(match[1]) * units[(match[2] ?? "B").toLowerCase()] : NaN;
    if (!Number.isSafeInteger(maxFileSize) || maxFileSize < 1) {
      throw new Error("--max-file-size must be a positive byte size (such as 10MB) or null.");
    }
  }
  const rawRows = values["max-rows"] ?? "null";
  const maxRows = rawRows.toLowerCase() === "null" ? null : Number(rawRows);
  if (maxRows !== null && (!/^[1-9]\d*$/.test(rawRows) || !Number.isSafeInteger(maxRows))) {
    throw new Error("--max-rows must be a positive safe integer or null (default).");
  }
  return { pageSize, maxFileSize, maxRows };
}

async function main() {
  const query = validateQuery(await readFile(path.join(process.cwd(), "src/app/data/create-catalog.sparql"), "utf8"));
  const { pageSize, maxFileSize, maxRows } = parseOptions();

  // Explicit environment variables take precedence over values in .env.
  if (existsSync(".env")) loadEnvFile(".env");
  const endpoint = process.env.SPARQL_ENDPOINT;
  if (!endpoint) throw new Error("SPARQL_ENDPOINT is not configured in the environment or .env");
  const csvFile = process.env.CSV_FILE;
  if (!csvFile) throw new Error("CSV_FILE is not configured in the environment or .env");

  let requested = false;
  async function request(query: string, context: string, logQuery = true): Promise<unknown> {
    if (requested) await sleep(1_000);
    requested = true;
    const url = new URL(endpoint!);
    url.searchParams.set("query", query);
    if (logQuery) console.error(`\n# Executing ${context}\n${query}\n`);
    const response = await fetch(url, {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "TriplePeek/0.1 (https://github.com/AlbertKhomich/triple-peek)",
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`${context} failed with HTTP ${response.status}`);
    return response.json();
  }

  const destination = path.resolve(csvFile);
  await mkdir(path.dirname(destination), { recursive: true });
  // Stage beside the destination so publishing the completed CSV is atomic.
  const staging = await mkdtemp(path.join(path.dirname(destination), ".prepare-catalog-"));
  const temporaryFile = path.join(staging, "catalog.csv");
  try {
    const file = await open(temporaryFile, "wx");
    let total = 0;
    try {
      let columns: string[] | undefined;
      let bytes = 0;
      let offset = 0;
      let sizeReached = false;
      while (!sizeReached && (maxRows === null || total < maxRows)) {
        const pageLimit = maxRows === null ? pageSize : Math.min(pageSize, maxRows - total);
        const pageQuery = `${query}\nLIMIT ${pageLimit}\nOFFSET ${offset}`;
        const result = await request(pageQuery, `catalog SELECT at offset ${offset}`);
        const pageColumns = readColumns(result);
        if (!columns) {
          columns = pageColumns;
          const header = columns.map(csvField).join(",") + "\n";
          bytes = Buffer.byteLength(header, "utf8");
          if (maxFileSize !== null && bytes > maxFileSize) {
            throw new Error(`CSV header requires ${bytes} bytes, exceeding --max-file-size.`);
          }
          await file.writeFile(header);
        } else if (columns.length !== pageColumns.length || columns.some((column, index) => column !== pageColumns[index])) {
          throw new Error("SELECT columns changed between pages");
        }
        const rows = readRows(result, columns);
        if (maxFileSize !== null && bytes === maxFileSize) {
          sizeReached = true;
          break;
        }
        if (rows.length > pageLimit) throw new Error(`Endpoint exceeded requested LIMIT ${pageLimit}`);
        if (rows.length === 0) break;
        const lines: string[] = [];
        for (const row of rows) {
          const line = columns.map((column) => csvField(row[column]?.value ?? "")).join(",") + "\n";
          const lineBytes = Buffer.byteLength(line, "utf8");
          if (maxFileSize !== null && bytes + lineBytes > maxFileSize) {
            sizeReached = true;
            break;
          }
          lines.push(line);
          bytes += lineBytes;
          total += 1;
          if (maxFileSize !== null && bytes === maxFileSize) {
            sizeReached = true;
            break;
          }
        }
        if (lines.length > 0) await file.writeFile(lines.join(""));
        offset += rows.length;
        console.error(`Fetched ${rows.length} rows; saved ${total} rows, ${bytes} bytes`);
        // Some endpoints enforce a smaller page cap; only an empty page ends export.
      }
      if (sizeReached) console.error(`File size cap reached; stopped at ${bytes} bytes with complete CSV rows.`);
      if (maxRows !== null && total === maxRows) console.error(`Row cap reached; stopped at ${total} data rows.`);
    } finally {
      await file.close();
    }
    // Docker runs as root by default. Give the published CSV to the owner of
    // the mounted output directory so it can be edited on the host afterward.
    if (process.getuid?.() === 0) {
      const { uid, gid } = await stat(path.dirname(destination));
      await chown(temporaryFile, uid, gid);
    }
    await rename(temporaryFile, destination);
    console.error(`Saved ${total} rows to ${destination}`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
