export function isValidIri(iri: string): boolean {
  // An absolute IRI must also be safe inside SPARQL's <IRIREF> syntax.
  return (
    /^[a-z][a-z0-9+.-]*:.+$/i.test(iri) &&
    !/[\u0000-\u0020\u007f<>"{}|^`\\]/u.test(iri)
  );
}

export async function describeEntity(iri: string): Promise<string> {
  if (!isValidIri(iri)) throw new Error("Invalid entity IRI");

  const endpoint = process.env.SPARQL_ENDPOINT;
  if (!endpoint) throw new Error("SPARQL_ENDPOINT is not configured");

  const url = new URL(endpoint);
  url.searchParams.set("query", `DESCRIBE <${iri}>`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/turtle, application/n-triples;q=0.9, application/ld+json;q=0.8, application/rdf+xml;q=0.7",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`SPARQL DESCRIBE failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("text/html")) {
    throw new Error("SPARQL endpoint returned HTML instead of RDF");
  }

  if (contentType.includes("json") && body.trim()) {
    return JSON.stringify(JSON.parse(body), null, 2);
  }

  return body;
}
