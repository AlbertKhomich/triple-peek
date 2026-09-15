import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { parse } from "csv-parse";

const REQUIRED_COLUMNS = new Set(["iri", "label"]);

const RESERVED_COLUMNS = new Set([
  "search_text",
  "search_vector",
]);

type Args = {
  table: string;
  csvPath: string;
  host: string;
  port: number;
  db: string;
  user: string;
  password?: string;
  update: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);

  if (argv.length < 2) {
    throw new Error(
      [
        "Usage:",
        "  npm run seed -- <table> <csv> --db <database> --user <user>",
        "",
        "Example:",
        "  npm run seed -- entity_search entities.csv --db triplepeek --user akhomich",
      ].join("\n")
    );
  }

  const table = argv[0];
  const csvPath = argv[1];

  let host = "localhost";
  let port = 5432;
  let db: string | undefined;
  let user: string | undefined;
  let password: string | undefined;
  let update = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--host":
        host = argv[++i];
        break;

      case "--port":
        port = Number(argv[++i]);
        break;

      case "--db":
        db = argv[++i];
        break;

      case "--user":
        user = argv[++i];
        break;

      case "--password":
        password = argv[++i];
        break;

      case "--update":
        update = true;
        break;

      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!db) {
    throw new Error("--db is required");
  }

  if (!user) {
    throw new Error("--user is required");
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("--port must be a valid positive integer");
  }

  return {
    table,
    csvPath,
    host,
    port,
    db,
    user,
    password,
    update,
  };
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function readCsvHeader(
  csvPath: string
): Promise<string[]> {
  const stream = fs.createReadStream(csvPath);

  const parser = stream.pipe(
    parse({
      bom: true,
      to_line: 1,
    })
  );

  for await (const record of parser) {
    const columns = (record as string[]).map(
      (column) => column.trim()
    );

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

  throw new Error("CSV is empty");
}

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

async function copyCsv(
  client: Client,
  targetTable: string,
  columns: string[],
  csvPath: string
) {
  const columnList = columns
    .map(quoteIdentifier)
    .join(", ");

  const copyQuery = `
    COPY ${quoteIdentifier(targetTable)}
      (${columnList})
    FROM STDIN
    WITH (
      FORMAT CSV,
      HEADER TRUE
    )
  `;

  const dbStream = client.query(
    copyFrom(copyQuery)
  );

  const fileStream =
    fs.createReadStream(csvPath);

  await pipeline(
    fileStream,
    dbStream
  );
}

async function createTempTable(
  client: Client,
  columns: string[]
) {
  const definitions = columns
    .map(
      (column) =>
        `${quoteIdentifier(column)} text`
    )
    .join(", ");

  await client.query(`
    CREATE TEMP TABLE graphpeek_import (
      ${definitions}
    )
    ON COMMIT DROP
  `);
}

async function upsertCsv(
  client: Client,
  table: string,
  columns: string[],
  csvPath: string
) {
  await createTempTable(
    client,
    columns
  );

  await copyCsv(
    client,
    "graphpeek_import",
    columns,
    csvPath
  );

  const columnList = columns
    .map(quoteIdentifier)
    .join(", ");

  const updateColumns = columns.filter(
    (column) => column !== "iri"
  );

  let conflictClause: string;

  if (updateColumns.length > 0) {
    const updates = updateColumns
      .map(
        (column) =>
          `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`
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

  /*
   * DISTINCT ON prevents PostgreSQL from trying to
   * update the same IRI multiple times when the input
   * CSV contains duplicate IRIs.
   *
   * For now, the first row encountered for each IRI
   * is kept.
   */
  await client.query(`
    INSERT INTO ${quoteIdentifier(table)}
      (${columnList})

    SELECT DISTINCT ON (${quoteIdentifier("iri")})
      ${columnList}

    FROM graphpeek_import

    ORDER BY ${quoteIdentifier("iri")}

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

  const columns =
    await readCsvHeader(csvPath);

  console.log(
    `Detected CSV columns: ${columns.join(", ")}`
  );

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

    console.log(
      `Preparing table '${args.table}'...`
    );

    await createTable(
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
        csvPath
      );
    } else {
      await copyCsv(
        client,
        args.table,
        columns,
        csvPath
      );
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