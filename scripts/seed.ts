import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { parseArgs } from "./catalog-args";
import { quoteIdentifier, RESERVED_COLUMNS, validateCatalog } from "./catalog-validation";

function buildSearchExpression(
  columns: string[]
): string {
  return columns
    .map(
      (column) =>
        `coalesce(${quoteIdentifier(column)}, '')`
    )
    .join(` || ' ' || `);
}

async function createTable(
  client: Client,
  table: string,
  columns: string[]
) {
  const tableName = quoteIdentifier(table);

  const columnDefinitions = columns.map(
    (column) => {
      if (column === "iri") {
        return `${quoteIdentifier(column)} text PRIMARY KEY`;
      }

      if (column === "label") {
        return `${quoteIdentifier(column)} text NOT NULL`;
      }

      return `${quoteIdentifier(column)} text`;
    }
  );

  const searchExpression =
    buildSearchExpression(columns);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnDefinitions.join(", ")},

      search_text text GENERATED ALWAYS AS (
        ${searchExpression}
      ) STORED,

      search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector(
          'simple'::regconfig,
          ${searchExpression}
        )
      ) STORED
    )
  `);

  // Serialize imports while inspecting and extending the existing schema.
  // The caller's transaction keeps schema changes and the CSV import atomic.
  await client.query(`LOCK TABLE ${tableName} IN SHARE ROW EXCLUSIVE MODE`);
  const existing = await client.query<{ name: string }>(`
    SELECT attname AS name
    FROM pg_attribute
    WHERE attrelid = $1::regclass
      AND attnum > 0
      AND NOT attisdropped
    ORDER BY attnum
  `, [tableName]);
  const existingColumns = existing.rows.map((row) => row.name);
  const missingColumns = columns.filter((column) => !existingColumns.includes(column));
  // Keep the full catalog schema, even when this CSV omits older fields.
  const allColumns = [
    ...existingColumns.filter((column) => !RESERVED_COLUMNS.has(column)),
    ...missingColumns,
  ];
  if (missingColumns.length === 0) return allColumns;

  console.log(`Adding CSV columns: ${missingColumns.join(", ")}`);
  await client.query(`
    ALTER TABLE ${tableName}
    ${missingColumns.map((column) => `ADD COLUMN ${quoteIdentifier(column)} text`).join(", ")}
  `);

  const updatedSearchExpression = buildSearchExpression(allColumns);

  // PostgreSQL 16 requires recreating stored generated columns to change their
  // expressions. Their indexes are removed automatically and recreated below
  // by createIndexes(). Do not CASCADE into external views or other objects.
  await client.query(`
    ALTER TABLE ${tableName}
      DROP COLUMN search_text,
      DROP COLUMN search_vector
  `);
  await client.query(`
    ALTER TABLE ${tableName}
      ADD COLUMN search_text text GENERATED ALWAYS AS (
        ${updatedSearchExpression}
      ) STORED,
      ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('simple'::regconfig, ${updatedSearchExpression})
      ) STORED
  `);
  return allColumns;
}

async function createIndexes(
  client: Client,
  table: string
) {
  const tableName = quoteIdentifier(table);

  const ftsIndex = quoteIdentifier(
    `${table}_fts_idx`
  );

  const trigramIndex = quoteIdentifier(
    `${table}_trgm_idx`
  );

  const labelPrefixIndex = quoteIdentifier(
    `${table}_label_prefix_idx`
  );

  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm
  `);

  // Full-text search across all imported columns.
  await client.query(`
    CREATE INDEX IF NOT EXISTS ${ftsIndex}
    ON ${tableName}
    USING GIN (search_vector)
  `);

  // Fuzzy / typo search across all imported columns.
  await client.query(`
    CREATE INDEX IF NOT EXISTS ${trigramIndex}
    ON ${tableName}
    USING GIN (search_text gin_trgm_ops)
  `);

  // Fast case-insensitive label prefix search.
  await client.query(`
    CREATE INDEX IF NOT EXISTS ${labelPrefixIndex}
    ON ${tableName} (
      lower(${quoteIdentifier("label")})
      text_pattern_ops
    )
  `);
}

async function upsertCsv(
  client: Client,
  table: string,
  columns: string[],
  catalogColumns: string[]
) {
  const columnList = columns
    .map(quoteIdentifier)
    .join(", ");

  const updateColumns = catalogColumns.filter(
    (column) => column !== "iri"
  );

  let conflictClause: string;

  if (updateColumns.length > 0) {
    const updates = updateColumns
      .map(
        (column) => {
          // Each incoming row replaces all searchable fields for this IRI.
          const value = columns.includes(column)
            ? `EXCLUDED.${quoteIdentifier(column)}`
            : "NULL";
          return `${quoteIdentifier(column)} = ${value}`;
        }
      )
      .join(", ");

    conflictClause = `
      ON CONFLICT (${quoteIdentifier("iri")})
      DO UPDATE SET
        ${updates}
    `;
  } else {
    conflictClause = `
      ON CONFLICT (${quoteIdentifier("iri")})
      DO NOTHING
    `;
  }

  await client.query(`
    INSERT INTO ${quoteIdentifier(table)}
      (${columnList})

    SELECT
      ${columnList}

    FROM graphpeek_import

    ${conflictClause}
  `);
}

async function main() {
  const args = parseArgs();

  const csvPath =
    path.resolve(args.csvPath);

  if (!fs.existsSync(csvPath)) {
    throw new Error(
      `CSV not found: ${csvPath}`
    );
  }

  const client = new Client({
    host: args.host,
    port: args.port,
    database: args.db,
    user: args.user,
    password: args.password,
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    const { columns, rows } = await validateCatalog(client, csvPath);
    console.log(`Catalog validated: ${rows} rows`);

    console.log(
      `Preparing table '${args.table}'...`
    );

    const catalogColumns = await createTable(
      client,
      args.table,
      columns
    );

    console.log(
      "Creating search indexes..."
    );

    await createIndexes(
      client,
      args.table
    );

    console.log(
      `Importing ${csvPath}...`
    );

    if (args.update) {
      await upsertCsv(
        client,
        args.table,
        columns,
        catalogColumns
      );
    } else {
      const columnList = columns.map(quoteIdentifier).join(", ");
      await client.query(`
        INSERT INTO ${quoteIdentifier(args.table)} (${columnList})
        SELECT ${columnList} FROM graphpeek_import
      `);
    }

    await client.query("COMMIT");

    console.log(
      `${csvPath} ${
        args.update
          ? "upserted"
          : "uploaded"
      } -> ${args.db}.${args.table}`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
