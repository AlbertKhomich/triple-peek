import path from "node:path";
import { Client } from "pg";
import { parseArgs } from "./catalog-args";
import { validateCatalog } from "./catalog-validation";

async function main() {
  const args = parseArgs("validate-catalog");
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
    const { rows } = await validateCatalog(client, path.resolve(args.csvPath));
    await client.query("ROLLBACK");
    console.log(`Catalog valid: CSV parses correctly; iri and label columns exist; all ${rows} IRIs are valid and unique.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
