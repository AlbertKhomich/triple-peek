<img width="1771" height="952" alt="TriplePeek" src="https://github.com/user-attachments/assets/de1bccb6-fac9-4a21-afc8-902ab4523114" />

# TriplePeek

TriplePeek is a lightweight search frontend for SPARQL knowledge graphs.

It combines a local PostgreSQL **search catalog** for fast entity discovery with configurable SPARQL queries for retrieving live RDF data.

The search catalog can be provided as a CSV or generated automatically from your SPARQL endpoint.

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

The repository includes a ready-to-run Wikidata demo.

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

After the initial setup, start TriplePeek with:

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
   IRI found
      │
      ├── Describe
      │
      └── Custom query buttons
                 │
                 ▼
          SPARQL endpoint
                 │
                 ├── RDF data
                 │
                 └── SERVICE → other SPARQL endpoints
```

TriplePeek does not search the SPARQL endpoint directly for every keystroke.

Instead, searchable entity metadata is stored locally in PostgreSQL. Search returns an IRI, and that IRI becomes the anchor for live queries against the configured SPARQL endpoint.

This keeps text search fast while leaving the RDF data in its original knowledge graph.

## Search Catalog

The search catalog maps search terms to RDF resources.

The default catalog path is configured through `CSV_FILE` and normally points to:

```text
src/app/data/search-catalog.csv
```

A catalog must contain at least:

```csv
iri,label
http://www.wikidata.org/entity/Q183,Germany
http://www.wikidata.org/entity/Q142,France
```

`iri` identifies the RDF resource.

`label` is the primary human-readable value shown and searched by TriplePeek.

Additional columns are automatically treated as searchable metadata.

For example:

```csv
iri,label,typeLabel,country
http://www.wikidata.org/entity/Q4152,Neuschwanstein Castle,museum | castle | château | tourist attraction | palace,Germany
http://www.wikidata.org/entity/Q12874774,Castle of Didymoteicho,castle | military base,Greece
```

The additional values do not need to correspond one-to-one with RDF properties.

They can be:

* exported from the knowledge graph
* transformed from RDF values
* enriched with alternative terminology
* manually curated for better search

For example, a castle could intentionally contain search terms such as:

```text
castle
château
tourist attraction
palace
Germany
```

even if those exact strings do not all occur in the source graph.

The catalog is a **search layer**, not a copy of the knowledge graph.

## Automatically Create a Search Catalog

TriplePeek can inspect a SPARQL endpoint and create the catalog automatically.

Set your endpoint and output file in `.env`:

```env
SPARQL_ENDPOINT=https://query.wikidata.org/sparql
CSV_FILE=/src/app/data/search-catalog.csv
```

Build the catalog generator:

```bash
docker compose build prepare-catalog
```

Generate a catalog:

```bash
docker compose run --rm prepare-catalog --limit 1000 --max-rows 10000
```

Or limit the generated file by size:

```bash
docker compose run --rm prepare-catalog --limit 1000 --max-file-size 10MB
```

Without `--max-rows` or `--max-file-size`, export continues until the endpoint returns an empty page.

When run as root in Docker, the generator assigns the CSV to the owner of the output directory, so you can edit it on the host without changing permissions or passing a user ID.

### What the generator does

Before exporting data, TriplePeek sends a set of small `ASK` queries to determine which configured RDF patterns are supported by the endpoint.

The default patterns cover common entity metadata including:

* `rdfs:label`
* `skos:prefLabel`
* `schema:name`
* `foaf:name`
* `rdf:type`
* RDFS superclasses
* Wikidata `P31`
* Wikidata `P279`

Only supported patterns are included in the generated `SELECT` query.

This means the same catalog generator can work with different RDF datasets without assuming that every endpoint uses the same vocabulary.

The generated query is printed before execution.

Results are fetched sequentially in pages using `LIMIT` and `OFFSET`.

A one-second pause is added between endpoint requests.

### Configure Catalog Discovery

Discovery patterns are defined in:

```text
src/app/data/catalog-patterns.json
```

Example:

```json
{
  "name": "schema:name (HTTPS)",
  "column": "schemaHttpsName",
  "labelPredicate": "https://schema.org/name",
  "language": "en"
}
```

Each pattern can define:

* `name` — human-readable name used in logs
* `column` — generated CSV column and SPARQL variable
* `labelPredicate` — RDF property containing the value
* `language` — optional literal language filter
* `relation` — optional relationship to follow before reading the label

For example, a pattern using `rdf:type` as its relation can store the labels of an entity's RDF types rather than labels attached directly to the entity.

Supported language values include:

```text
"en"
"de"
"fr"
"en-GB"
""
"*"
```

`""` selects untagged literals.

`"*"` accepts any non-empty language tag.

Patterns can be added, removed, or reordered without changing the catalog-generation code.

Because the pattern configuration is mounted into the Docker container, changes to `catalog-patterns.json` do not require rebuilding the image.

## Generated Catalog Behavior

The generated `SELECT` query discovers candidate IRIs from all supported patterns.

Metadata values are then retrieved using independent `OPTIONAL` blocks.

This is important because an entity is not removed simply because one particular label, type, or metadata field is missing.

Missing values become empty CSV fields.

The export is intentionally raw. A knowledge graph may return multiple rows for the same IRI because of:

* multiple RDF types
* multiple superclass relationships
* multiple labels
* combinations of optional properties

TriplePeek handles these duplicates during validation.

Rows sharing the same IRI are grouped into a single catalog row, and unique non-empty values from each metadata column are joined with:

```text
 | 
```

For example:

```csv
iri,label,typeLabel
http://example.org/123,Example Entity,Person | Researcher | Author
```

## Import the Search Catalog

Every import validates the catalog before modifying PostgreSQL.

Seed the catalog with:

```bash
docker compose run --rm seed
```

The importer checks:

* valid CSV syntax
* consistent row widths
* presence of `iri`
* presence of `label`
* valid IRIs using RFC 3987 validation
* duplicate IRIs

If the generated CSV uses another name for its second column, that column is automatically renamed to `label`.

If duplicate IRIs are found, their rows are automatically grouped and validation is retried.

If validation still fails, the database remains unchanged.

### Update an Existing Catalog

Without `--update`, importing an IRI that already exists causes the import to fail.

To insert new IRIs and replace catalog data for existing ones:

```bash
docker compose run --rm seed -- --update
```

For an existing IRI:

* values from the new CSV replace the existing catalog values
* empty fields clear previous values
* omitted metadata columns become `NULL`
* values are not merged with the previous database row

IRIs not present in the CSV remain unchanged.

### Validate Without Importing

To validate the configured catalog without seeding it:

```bash
docker compose run --rm seed validate-catalog
```

The CSV is streamed during validation instead of being loaded entirely into memory.

A temporary PostgreSQL staging table is used to validate and detect duplicate IRIs before any search data is changed.

## Use Your Own Knowledge Graph

To connect TriplePeek to another SPARQL endpoint:

1. Set `SPARQL_ENDPOINT` in `.env`.
2. Set `CSV_FILE` to the desired catalog path.
3. Generate the catalog.
4. Seed PostgreSQL.
5. Start the application.

For example:

```bash
docker compose build prepare-catalog
```

```bash
docker compose run --rm prepare-catalog --limit 1000 --max-rows 10000
```

```bash
docker compose up -d db
docker compose run --rm seed
docker compose up -d --build app
```

Open:

```text
http://localhost:3000
```

If you switch to a completely different dataset and want to discard the existing search database:

```bash
docker compose down -v
docker compose up -d db
docker compose run --rm seed
docker compose up -d --build app
```

You can also skip automatic catalog generation and provide your own CSV if you already have a curated search dataset.

## Catalog Generation Limits

Catalog generation supports two optional limits.

Limit the number of data rows:

```bash
docker compose run --rm prepare-catalog --limit 1000 --max-rows 10000
```

Limit the output file size:

```bash
docker compose run --rm prepare-catalog --limit 1000 --max-file-size 10MB
```

Both options can be combined:

```bash
docker compose run --rm prepare-catalog \
  --limit 1000 \
  --max-rows 100000 \
  --max-file-size 100MB
```

Export stops when the first configured limit is reached.

`--limit` controls the number of rows requested from the SPARQL endpoint per page.

File sizes support:

```text
KB
MB
GB
KiB
MiB
GiB
```

The file-size limit includes the CSV header, escaping, newlines, and UTF-8 encoding.

The final row is never partially written.

If export fails, the existing catalog file is left unchanged.

## Optional Query Buttons

Every search result includes a **Describe** button that retrieves RDF triples for the selected entity.

Additional query buttons can be added by placing `.sparql` files in:

```text
src/app/data/buttons/
```

For example:

```text
src/app/data/buttons/
  details.sparql
  embedding.sparql
```

Each file automatically creates a button using the filename as its name.

The bundled demo includes:

* `details.sparql` — retrieves an image, coordinates, and description for the selected Wikidata entity
* `embedding.sparql` — uses the selected entity as an anchor and retrieves its embedding from another SPARQL endpoint using `SERVICE`

<img width="870" height="906" alt="TriplePeek query buttons" src="https://github.com/user-attachments/assets/4af5efe7-b3aa-4801-92c5-b295e24200fd" />

A query file may contain a read-only:

* `SELECT`
* `ASK`
* `CONSTRUCT`
* `DESCRIBE`

Use:

```text
<${iri}>
```

wherever the selected entity should be inserted.

Example:

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

When the button is opened, TriplePeek replaces `${iri}` with the IRI selected from the search results and sends the query to the configured SPARQL endpoint.

The query can also access another endpoint through SPARQL federation:

```sparql
SERVICE <https://example.org/sparql> {
  ...
}
```

Query templates are trusted server-side configuration.

SPARQL update operations are not supported.

After adding, removing, or modifying query files, rebuild the application:

```bash
docker compose up -d --build app
```

## Architecture

TriplePeek deliberately separates **entity discovery** from **RDF retrieval**.

```text
              ┌──────────────────────┐
              │    Search Catalog    │
              │         CSV          │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │      PostgreSQL      │
              │   full-text search   │
              └──────────┬───────────┘
                         │
                    selected IRI
                         │
                         ▼
              ┌──────────────────────┐
              │      TriplePeek      │
              └──────────┬───────────┘
                         │
                    SPARQL queries
                         │
                         ▼
              ┌──────────────────────┐
              │   SPARQL Endpoint    │
              └──────────┬───────────┘
                         │
                         └──── SERVICE ────► other endpoints
```

The search catalog can therefore remain intentionally small and optimized for discovery even when the underlying knowledge graph contains billions of triples.

TODO:
- label appears as the main clickable result heading.
- typeLabel appears as a badge beside the heading, provided it’s nonempty and at most 80 characters long.
Other metadata fields appear below the heading and IRI as name/value pairs.