import fs from "node:fs";
import { chmod, chown, mkdtemp, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";

function encodeRow(row: string[]): string {
  return row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",") + "\n";
}

async function* readCsv(csvPath: string): AsyncGenerator<string[]> {
  const input = fs.createReadStream(csvPath);
  const parser = parse({ bom: true });
  input.on("error", (error) => parser.destroy(error));
  input.pipe(parser);
  try {
    for await (const record of parser) yield record as string[];
  } finally {
    input.destroy();
    parser.destroy();
  }
}

// Stage beside the destination so replacement is atomic, including in Docker.
async function writeCsv(output: string, rows: AsyncIterable<string[]>, replace = () => true) {
  const directory = await mkdtemp(path.join(path.dirname(output), ".catalog-"));
  const staging = path.join(directory, "output.csv");
  try {
    await pipeline(rows, async function* (records) {
      for await (const row of records) yield encodeRow(row);
    }, fs.createWriteStream(staging));
    if (replace()) {
      const original = await stat(output).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      });
      if (original) {
        const staged = await stat(staging);
        if (staged.uid !== original.uid || staged.gid !== original.gid) {
          await chown(staging, original.uid, original.gid);
        }
        // Apply permissions after chown, which can clear special mode bits.
        await chmod(staging, original.mode & 0o7777);
      }
      await rename(staging, output);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function ensureLabelColumn(csvPath: string) {
  let changed = false;
  async function* rows() {
    let header = true;
    for await (const record of readCsv(csvPath)) {
      if (header) {
        header = false;
        if (record.length < 2) throw new Error("CSV must have at least two columns");
        if (record[1] !== "label") {
          if (record.some((column, index) => index !== 1 && column.trim() === "label")) {
            throw new Error("Cannot rename second CSV column: another column is already named 'label'");
          }
          record[1] = "label";
          changed = true;
        }
      }
      yield record;
    }
    if (header) throw new Error("CSV has no header");
  }
  await writeCsv(csvPath, rows(), () => changed);
  if (changed) console.log("Renamed second CSV column to 'label'.");
}

export async function groupCsv(input: string, output: string, groupBy?: string, separator = " | ") {
  let columns: string[] | undefined;
  let groupIndex = 0;
  const grouped = new Map<string, Set<string>[]>();
  await pipeline(fs.createReadStream(input), parse({ bom: true }), async (records) => {
    for await (const row of records) {
      const record = row as string[];
      if (!columns) {
        columns = record;
        if (new Set(columns).size !== columns.length) throw new Error("CSV contains duplicate column names");
        groupIndex = groupBy === undefined ? 0 : columns.indexOf(groupBy);
        if (groupIndex < 0) throw new Error(`Column not found: ${groupBy}`);
        continue;
      }
      const key = record[groupIndex];
      let values = grouped.get(key);
      if (!values) {
        values = columns.map(() => new Set<string>());
        grouped.set(key, values);
      }
      record.forEach((value, index) => {
        if (index !== groupIndex && value) values[index].add(value);
      });
    }
  });
  if (!columns) throw new Error("CSV has no header");
  const header = columns;
  async function* rows() {
    yield header;
    for (const [key, values] of grouped) {
      yield values.map((items, index) => index === groupIndex ? key : [...items].join(separator));
    }
  }
  await writeCsv(output, rows());
}
