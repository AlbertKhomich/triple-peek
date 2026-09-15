import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const queryPath = path.join(process.cwd(), "src", "app", "data", "expand.sparql");

function isMissing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function hasExpandQuery(): Promise<boolean> {
  try {
    return (await stat(queryPath)).isFile();
  } catch (error) {
    if (!isMissing(error)) console.error("Unable to check optional details query", error);
    return false;
  }
}

export async function readExpandQuery(): Promise<string | null> {
  try {
    return await readFile(queryPath, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
