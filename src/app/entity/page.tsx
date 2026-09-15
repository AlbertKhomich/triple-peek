import Link from "next/link";
import { describeEntity, isValidIri } from "../../../lib/sparql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EntityPageProps = {
  searchParams: Promise<{ iri?: string | string[]; label?: string | string[] }>;
};

export default async function EntityPage({ searchParams }: EntityPageProps) {
  const params = await searchParams;
  const iri = typeof params.iri === "string" ? params.iri : "";
  const label = typeof params.label === "string" ? params.label.trim() : "";
  let description = "";
  let error = "";

  if (!isValidIri(iri)) {
    error = "Choose a search result with a valid IRI to view its description.";
  } else {
    try {
      description = await describeEntity(iri);
    } catch (cause) {
      console.error("Unable to load entity description", cause);
      error = "The description could not be loaded. Please try again shortly.";
    }
  }

  return (
    <main className="entity-page">
      <div className="entity-content">
        <Link className="entity-back" href="/">← Back to search</Link>
        <header className="entity-header">
          <h1>{label || "Entity description"}</h1>
          {iri && <p className="entity-iri">{iri}</p>}
        </header>
        <section className="entity-description" aria-labelledby="description-title">
          <h2 id="description-title">Description</h2>
          {error ? (
            <div className="entity-message" role="alert">
              <p>{error}</p>
              {isValidIri(iri) && (
                <a className="entity-back" href={`/entity?${new URLSearchParams({ iri, label })}`}>
                  Try again
                </a>
              )}
            </div>
          ) : description.trim() ? (
            <pre className="entity-rdf" tabIndex={0} aria-label="Entity description data">
              <code>{description}</code>
            </pre>
          ) : (
            <p className="entity-message">No description was returned for this entity.</p>
          )}
        </section>
      </div>
    </main>
  );
}
