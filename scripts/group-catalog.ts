#!/usr/bin/env node
import { parseArgs } from "node:util";
import { groupCsv } from "./catalog-transform";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "group-by": { type: "string" },
      separator: { type: "string", default: " | " },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log('Usage: npm run group-catalog -- INPUT OUTPUT [--group-by COLUMN] [--separator " | "]\nGroup by the first column by default; aggregate unique nonempty values in encounter order.');
    return;
  }
  if (positionals.length !== 2) throw new Error("Expected input and output CSV paths; use --help for usage.");
  await groupCsv(positionals[0], positionals[1], values["group-by"], values.separator);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
