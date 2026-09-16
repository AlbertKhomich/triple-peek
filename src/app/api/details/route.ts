import { readExpandQuery } from "../../../../lib/expand-query";
import { isValidIri } from "../../../../lib/sparql";
import { isSparqlResults } from "@/lib/sparql-results";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const iri = new URL(request.url).searchParams.get("iri")?.trim() ?? "";
  if (!isValidIri(iri)) {
    return Response.json({ error: "Missing or invalid IRI" }, { status: 400 });
  }

  try {
    const template = await readExpandQuery();
    if (template === null) {
      return Response.json({ error: "Details are not available." }, { status: 404 });
    }
    const endpoint = process.env.SPARQL_ENDPOINT;
    if (!endpoint) throw new Error("SPARQL_ENDPOINT is not configured");
    // The optional file is a trusted server-side template; only a validated
    // IRI is substituted into its <${iri}> placeholders.
    const query = template.replaceAll("${iri}", () => iri);
    const url = new URL(endpoint);
    url.searchParams.set("query", query);
    const response = await fetch(url, {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "TriplePeek/0.1 (https://github.com/AlbertKhomich/triple-peek)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`SPARQL details failed with HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!isSparqlResults(payload)) throw new Error("Invalid SPARQL JSON results");
    return Response.json(payload);
  } catch (error) {
    console.error("Unable to load entity details", error);
    return Response.json({ error: "Details could not be loaded. Please try again shortly." }, { status: 500 });
  }
}
