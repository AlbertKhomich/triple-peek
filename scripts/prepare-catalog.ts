import { existsSync } from "node:fs";
import { chown, mkdir, mkdtemp, open, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

import configuredPatterns from "../src/app/data/catalog-patterns.json";
import { isValidIri } from "../lib/sparql";

type PatternConfig = {
  name: string;
  column: string;
  labelPredicate: string;
  relation?: string;
  language?: string;
};
type Probe = { key: string; name: string; pattern: string; language: string };

function loadProbes(): Probe[] {
  const columns = new Set(["iri"]);
  return (configuredPatterns as PatternConfig[]).map((entry) => {
    const language = entry.language ?? "en";
    if (typeof language !== "string" || !/^(?:[A-Za-z]+(?:-[A-Za-z0-9]+)*|\*)?$/.test(language)) {
      throw new Error(`Invalid label language in catalog pattern: ${entry.name}`);
    }
    if (!entry.name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry.column)
      || columns.has(entry.column)) {
      throw new Error("Catalog patterns need a name and a unique SPARQL-safe column (other than iri).");
    }
    if (!isValidIri(entry.labelPredicate)
      || (entry.relation !== undefined && !isValidIri(entry.relation))) {
      throw new Error(`Invalid predicate IRI in catalog pattern: ${entry.name}`);
    }
    columns.add(entry.column);
    return {
      key: entry.column,
      name: entry.name,
      language,
      pattern: entry.relation
        ? `?s <${entry.relation}> ?type .\n?type <${entry.labelPredicate}> ?typeLabel .`
        : `?s <${entry.labelPredicate}> ?label .`,
    };
  });
}

function buildQuery(matches: Probe[]): { query: string; columns: string[] } {
  const columns = ["iri", ...matches.map((probe) => probe.key)];
  const candidates = matches.map((probe) => {
    // Only discover subjects here; output labels come from the OPTIONAL blocks.
    const pattern = probe.pattern.split("\n", 1)[0]
      .replace(/\?s\b/g, "?iri")
      .replace(/\?(label|type)\b/g, `?candidate_${probe.key}`);
    return `  { ${pattern} }`;
  });
  const blocks = matches.map((probe) => {
    const column = probe.key;
    const pattern = probe.pattern
      .replace(/\?s\b/g, "?iri")
      .replace(/\?(label|typeLabel)\b/g, `?${column}`)
      // Keep type variables independent across OPTIONAL blocks.
      .replace(/\?type\b/g, `?${column}Type`);
    const languageFilter = probe.language === ""
      ? `LANG(?${column}) = ""`
      : `LANGMATCHES(LANG(?${column}), "${probe.language}")`;
    const filter = `FILTER(isLiteral(?${column}) && ${languageFilter})`;
    return `  OPTIONAL {
    ${pattern.split("\n").join("\n    ")}
    ${filter}
  }`;
  });
  return {
    columns,
    query: `SELECT ${columns.map((column) => `?${column}`).join(" ")}
WHERE {
${candidates.length ? candidates.join("\n  UNION\n") : "  FILTER(false)"}
  FILTER(isIRI(?iri))
${blocks.join("\n")}
}`,
  };
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
      limit: { type: "string" },
      "max-rows": { type: "string" },
      "max-file-size": { type: "string" },
      "file-size": { type: "string" },
    },
    allowPositionals: true,
  });
  if (positionals.length > 2 || (values.limit !== undefined && positionals.length > 0)
    || (values["max-file-size"] !== undefined && values["file-size"] !== undefined)
    || (positionals.length > 1 && (values["max-file-size"] !== undefined || values["file-size"] !== undefined))) {
    throw new Error("Use --limit <rows> --max-file-size <bytes|10MB|null>, or positional <limit> [size].");
  }
  const rawLimit = values.limit ?? positionals[0] ?? "1000";
  const limit = Number(rawLimit);
  if (!/^[1-9]\d*$/.test(rawLimit) || !Number.isSafeInteger(limit)) {
    throw new Error("--limit must be a positive safe integer (default: 1000).");
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
  return { limit, maxFileSize, maxRows };
}

async function main() {
  const probes = loadProbes();
  const { limit, maxFileSize, maxRows } = parseOptions();

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
      const matches: Probe[] = [];
      for (const [index, probe] of probes.entries()) {
        const result = await request(`ASK {\n${probe.pattern}\n}`, `ASK ${index + 1} (${probe.name})`, false);
        if (!result || typeof result !== "object" || !("boolean" in result) || typeof result.boolean !== "boolean") {
          throw new Error(`ASK ${index + 1} (${probe.name}) did not return a SPARQL JSON boolean`);
        }
        console.error(`[${index + 1}/${probes.length}] ${probe.name}: ${result.boolean}`);
        if (result.boolean) {
          matches.push(probe);
        }
      }

      const { query, columns } = buildQuery(matches);
      const header = columns.join(",") + "\n";
      let bytes = Buffer.byteLength(header, "utf8");
      if (maxFileSize !== null && bytes > maxFileSize) {
        throw new Error(`CSV header requires ${bytes} bytes, exceeding --max-file-size.`);
      }
      await file.writeFile(header);
      let offset = 0;
      let sizeReached = maxFileSize !== null && bytes === maxFileSize;
      while (matches.length > 0 && !sizeReached && (maxRows === null || total < maxRows)) {
        const pageLimit = maxRows === null ? limit : Math.min(limit, maxRows - total);
        const pageQuery = `${query}\nLIMIT ${pageLimit}\nOFFSET ${offset}`;
        const result = await request(pageQuery, `catalog SELECT at offset ${offset}`);
        const rows = readRows(result, columns);
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
