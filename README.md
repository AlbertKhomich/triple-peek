<img width="1771" height="952" alt="Screenshot 2026-09-16 at 15 29 52" src="https://github.com/user-attachments/assets/de1bccb6-fac9-4a21-afc8-902ab4523114" />

# TriplePeek

TriplePeek is a lightweight search frontend for SPARQL knowledge graphs.

It uses a local **search catalog** for fast entity discovery and retrieves live RDF data from a SPARQL endpoint.

## Quick Start

Requirements:

* Git
* Docker
* Docker Compose

Clone the project:

```bash
git clone https://github.com/AlbertKhomich/triple-peek
cd triple-peek
```

Create the environment file:

```bash
cp .env.example .env
```

The repository includes a ready-to-run Wikidata demo with a matching search catalog and `expand.sparql` query.

Start it:

```bash
docker compose build
docker compose up -d db
docker compose run --rm seed
docker compose up -d app
```

Open:

```text
http://localhost:3000
```

After the first setup, start TriplePeek with:

```bash
docker compose up -d db app
```

Stop it with:

```bash
docker compose down
```

## Search Catalog

TriplePeek does **not** automatically index your knowledge graph.

Instead, you provide a CSV **search catalog** that defines how users discover RDF resources.

The default catalog is:

```text
src/app/data/entities.csv
```

Example:

```csv
iri,label,typeLabel,country
http://www.wikidata.org/entity/Q4152,Neuschwanstein Castle,museum | castle | château | tourist attraction | palace,Germany
http://www.wikidata.org/entity/Q12874774,Castle of Didymoteicho,castle | military base,Greece
```

Each row represents one RDF resource.

* `iri` identifies the resource in the configured SPARQL endpoint.
* `label` is the human-readable label shown in search results.
* Any additional columns are searchable metadata.

Only the `iri` needs to correspond directly to the RDF resource.

The `label` and other search values can come from the RDF dataset, but they do not have to. They can be transformed, enriched, or manually curated specifically for search.

For example, terms such as:

```text
castle
château
tourist attraction
palace
Germany
```

can be added to help users discover an entity even if those exact values do not occur in the knowledge graph.

You can create the catalog by:

* exporting selected properties with SPARQL
* generating it with a script or ETL pipeline
* manually curating or enriching search terms

## How It Works

```text
Search catalog
     │
     ▼
PostgreSQL
     │
     │ search
     ▼
   IRI
     │
     ▼
SPARQL endpoint
     │
     ▼
Live RDF data
```

The CSV is therefore **not an export of the knowledge graph**.

It is a search layer that maps useful search terms to RDF resources.

## Use Your Own Dataset

To connect TriplePeek to another knowledge graph:

1. Change `SPARQL_ENDPOINT` in `.env`.
2. Replace the demo search catalog with one containing IRIs from your endpoint.
3. Optionally replace `expand.sparql` with a query matching your dataset.
4. Re-import the catalog.

To reset the existing search data:

```bash
docker compose down -v
docker compose up -d db
docker compose run --rm seed
docker compose up -d app
```

## Add More Search Data

You can import additional rows only if their `iri` values are not already present in the search catalog.

Prepare a CSV containing only new IRIs, then run:

```bash
docker compose run --rm seed
```

If you need to change data for an IRI that already exists, reset the search database and import the updated catalog again:

```bash
docker compose down -v
docker compose up -d db
docker compose run --rm seed
docker compose up -d app
```

## Optional Details Query

Every result has a **Describe** button for retrieving related RDF triples.

TriplePeek can also show an optional **Details** button using:

```text
src/app/data/expand.sparql
```

<img width="872" height="517" alt="Screenshot 2026-09-16 at 12 19 40" src="https://github.com/user-attachments/assets/71eda5bf-5d34-4482-833c-0d18e93b7745" />

Label, description, types and thumbnail are provided by **Details**.

The repository includes a demo `expand.sparql`.

Inside this file, write any SPARQL `SELECT` query you want and use `<${iri}>` wherever you need the currently selected entity as the anchor.

For example:

```sparql
PREFIX schema: <http://schema.org/>

SELECT ?name ?description
WHERE {
  OPTIONAL {
    <${iri}> schema:name ?name .
  }

  OPTIONAL {
    <${iri}> schema:description ?description .
  }
}
```

When a user opens **Details**, TriplePeek replaces `${iri}` with the IRI of the selected search result and sends the query to the configured SPARQL endpoint.

The query can fetch any data related to that entity according to your dataset schema.

Delete `expand.sparql` if you do not want the **Details** button.

After changing `expand.sparql` in Docker, rebuild the app:

```bash
docker compose up -d --build app
```
