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

The repository includes a ready-to-run Wikidata demo with a matching search catalog, `buttons/details.sparql` query, and SPARQL endpoint configured in `.env.example`.

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

The CSV is **not required to be an export of the knowledge graph**.

It is a search layer that maps useful search terms to RDF resources.

## Search Catalog

TriplePeek does **not** automatically index your knowledge graph.

Instead, you provide a CSV **search catalog** that defines how users discover RDF resources.

The default catalog is:

```text
src/app/data/entities.csv
```

The catalog must contain these two columns:

* `iri` — **required**; identifies the resource in the configured SPARQL endpoint.
* `label` — **required**; the human-readable label shown in search results.

Any additional columns are optional and treated as searchable metadata.

Example:

```csv
iri,label,typeLabel,country
http://www.wikidata.org/entity/Q4152,Neuschwanstein Castle,museum | castle | château | tourist attraction | palace,Germany
http://www.wikidata.org/entity/Q12874774,Castle of Didymoteicho,castle | military base,Greece
```

Each row represents one RDF resource.

Only the `iri` must correspond directly to an RDF resource.

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

## Use Your Own Dataset

To connect TriplePeek to another knowledge graph:

1. Change `SPARQL_ENDPOINT` in `.env`.
2. Replace the demo search catalog with one containing IRIs from your endpoint.
3. Optionally add queries tailored to your dataset in `src/app/data/buttons/`.
4. Reset the search database and import the new catalog.

To reset the existing search data:

```bash
docker compose down -v
docker compose up -d db
docker compose run --rm seed
docker compose up -d --build app
```

## Import and Update the Search Catalog

Without `--update`, all IRIs in the CSV must be new.

Import new catalog entries with:

```bash
docker compose run --rm seed
```

To insert new IRIs and replace catalog data for existing IRIs, use `--update`:

```bash
docker compose run --rm seed -- --update
```

For an existing IRI, the new CSV row replaces its label and all searchable metadata.

Empty values clear previous values, and metadata columns omitted from the CSV are cleared to `NULL` for that IRI. Values are not merged.

IRIs absent from the CSV remain unchanged.

Without `--update`, an existing IRI causes the entire import to fail and roll back.

For a local import without Docker:

```bash
npm run seed -- entity_search src/app/data/entities.csv --db triplepeek --user triplepeek --update
```

## Validate a Search Catalog

Every seed validates the entire CSV before modifying the search catalog.

Validation checks:

* CSV syntax and consistent row widths
* required `iri` and `label` headers
* valid IRIs using strict RFC 3987 validation
* duplicate IRIs

Duplicate IRIs within the CSV are rejected even with `--update`.

To validate without seeding in Docker:

```bash
docker compose run --rm seed validate-catalog
```

Docker Compose starts PostgreSQL automatically and waits until it is ready. The command uses `CSV_FILE` and the database credentials from `.env`; no local PostgreSQL installation or connection flags are needed.

Normal seeding also validates automatically:

```bash
docker compose run --rm seed
```

For local use with an accessible PostgreSQL database:

```bash
npm run validate-catalog -- src/app/data/entities.csv --db triplepeek --user triplepeek
```

Local npm commands do not load `.env`. They support `--host`, `--port`, and `--password`.

The CSV is streamed through `csv-parse`, headers and IRIs are validated, and rows are copied into a temporary PostgreSQL staging table whose primary key detects duplicate IRIs. Standalone validation discards the staging table; seeding imports it only after all checks succeed.

Any failure exits with a nonzero status and leaves the search catalog unchanged.

## Optional Query Buttons

Every search result includes a **Describe** button for retrieving RDF triples for the selected resource.

You can add additional query buttons by placing `.sparql` files in:

```text
src/app/data/buttons/
```

For example:

```text
src/app/data/buttons/
  details.sparql      → Details
  embedding.sparql    → Embedding
```

Each file creates a button whose name is derived from the filename.

The bundled demo includes:

* `details.sparql` — retrieves the image, coordinates, and description for the selected Wikidata entity
* `embedding.sparql` — uses the selected entity as an anchor and retrieves its embedding from another SPARQL endpoint through a federated `SERVICE` query

<img width="874" height="684" alt="Screenshot 2026-09-17 at 12 16 25" src="https://github.com/user-attachments/assets/ed244c64-9d0c-40b4-acf6-5a48fd68aebf" />

Each file can contain a read-only SPARQL `SELECT`, `ASK`, `CONSTRUCT`, or `DESCRIBE` query.

Use `<${iri}>` wherever the selected search result should act as the query anchor.

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

When a user opens a custom button, TriplePeek replaces `${iri}` with the IRI of the selected search result and sends the query to the configured SPARQL endpoint.

The query can use that entity as an anchor to retrieve any data supported by the endpoint, including data from other SPARQL endpoints through `SERVICE`.

Query templates are trusted server-side configuration. SPARQL update operations are not supported.

To remove a button, delete its corresponding `.sparql` file.

After adding, removing, or changing query files in Docker, rebuild the app:

```bash
docker compose up -d --build app
```
