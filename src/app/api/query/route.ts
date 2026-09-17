import { queryForm, readButtonQuery } from "../../../../lib/query-buttons";
import { isValidIri } from "../../../../lib/sparql";
import { isSparqlResults } from "@/lib/sparql-results";
import { parseDescribeBodyWithN3 } from "@/lib/rdf";
import type { QueryResponse } from "@/lib/query-types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const iri = params.get("iri")?.trim() ?? "";
  const button = params.get("button") ?? "";
  if (!isValidIri(iri) || !button) {
    return Response.json({ error: "Missing button or invalid IRI" }, { status: 400 });
  }
  try {
    const template = await readButtonQuery(button);
    if (template === null) return Response.json({ error: "Unknown query button" }, { status: 404 });
    const query = template.replaceAll("${iri}", () => iri);
    const form = queryForm(query);
    const results = form === "SELECT" || form === "ASK";
    const endpoint = process.env.SPARQL_ENDPOINT;
    if (!endpoint) throw new Error("SPARQL_ENDPOINT is not configured");
    const url = new URL(endpoint);
    url.searchParams.set("query", query);
    const response = await fetch(url, {
      headers: {
        Accept: results ? "application/sparql-results+json" : "text/turtle, application/n-triples;q=0.9, application/ld+json;q=0.8, application/rdf+xml;q=0.7",
        "User-Agent": "TriplePeek/0.1 (https://github.com/AlbertKhomich/triple-peek)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`SPARQL query failed with HTTP ${response.status}`);
    let payload: QueryResponse;
    if (results) {
      const data: unknown = await response.json();
      if (!isSparqlResults(data)) throw new Error("Invalid SPARQL JSON results");
      payload = { kind: "results", data };
    } else {
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.toLowerCase().includes("text/html")) throw new Error("Expected RDF, received HTML");
      const body = await response.text();
      payload = { kind: "rdf", data: { iri, body, contentType, ...parseDescribeBodyWithN3(body, contentType) } };
    }
    return Response.json(payload);
  } catch (error) {
    console.error("Unable to run custom query", error);
    return Response.json({ error: "The query could not be loaded. Please try again shortly." }, { status: 500 });
  }
}
