export type SparqlBinding = {
  type: "uri" | "bnode" | "literal" | "typed-literal";
  value: string;
  "xml:lang"?: string;
  datatype?: string;
};

export type SparqlResults = {
  head: { vars?: string[] };
  boolean?: boolean;
  results?: { bindings: Record<string, SparqlBinding>[] };
};

export function isSparqlResults(value: unknown): value is SparqlResults {
  if (!value || typeof value !== "object" || !("head" in value)) return false;
  if (!value.head || typeof value.head !== "object") return false;
  if ("boolean" in value) return typeof value.boolean === "boolean";
  if (!("vars" in value.head) || !Array.isArray(value.head.vars) ||
      !value.head.vars.every((variable) => typeof variable === "string")) return false;
  if (!("results" in value) || !value.results || typeof value.results !== "object" ||
      !("bindings" in value.results) || !Array.isArray(value.results.bindings)) return false;
  return value.results.bindings.every((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    return Object.values(row).every((binding: unknown) => {
      if (!binding || typeof binding !== "object" || !("type" in binding) || !("value" in binding)) return false;
      return typeof binding.type === "string" &&
        ["uri", "bnode", "literal", "typed-literal"].includes(binding.type) &&
        typeof binding.value === "string" &&
        (!("xml:lang" in binding) || typeof binding["xml:lang"] === "string") &&
        (!("datatype" in binding) || typeof binding.datatype === "string");
    });
  });
}
