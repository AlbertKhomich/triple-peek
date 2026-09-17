import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { QueryButton } from "../src/lib/query-types";

const directory = path.join(process.cwd(), "src", "app", "data", "buttons");

export async function listQueryButtons(): Promise<QueryButton[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".sparql") && entry.name !== ".sparql")
      .map((entry) => {
        const id = entry.name.slice(0, -7);
        const name = id.replace(/_/g, " ");
        return { id, label: id.toLowerCase() === "describe" ? "Describe (custom)" : name.charAt(0).toUpperCase() + name.slice(1) };
      })
      .sort((a, b) => a.id.localeCompare(b.id, "en"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export async function readButtonQuery(id: string): Promise<string | null> {
  // Resolve only exact identifiers from regular files in the buttons directory.
  if (!(await listQueryButtons()).some((button) => button.id === id)) return null;
  return readFile(path.join(directory, `${id}.sparql`), "utf8");
}

export function queryForm(query: string): "SELECT" | "ASK" | "CONSTRUCT" | "DESCRIBE" {
  // Skip the prologue without treating # inside a prefix/base IRI as a comment.
  const gap = String.raw`(?:\s|#[^\r\n]*(?:\r?\n|$))*`;
  const declaration = new RegExp(`^${gap}(?:BASE${gap}<[^>]*>|PREFIX\\s+[^\\s:]*:${gap}<[^>]*>)`, "i");
  let remaining = query;
  let match: RegExpMatchArray | null;
  while ((match = remaining.match(declaration))) remaining = remaining.slice(match[0].length);
  const form = remaining.match(new RegExp(`^${gap}(SELECT|ASK|CONSTRUCT|DESCRIBE)\\b`, "i"))?.[1].toUpperCase();
  if (!form) throw new Error("Custom buttons require a SELECT, ASK, CONSTRUCT, or DESCRIBE query");
  return form as "SELECT" | "ASK" | "CONSTRUCT" | "DESCRIBE";
}
