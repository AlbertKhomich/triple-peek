## Automatically Create a Search Catalog

TriplePeek creates the catalog by executing your query from `src/app/data/create-catalog.sparql` against the configured SPARQL endpoint.

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
docker compose run --rm prepare-catalog --page-size 1000 --max-rows 10000
```

`--page-size` controls the number of rows requested from the SPARQL endpoint per page.

Or limit the generated file by size:

```bash
docker compose run --rm prepare-catalog --page-size 1000 --max-file-size 10MB
```

Without `--max-rows` or `--max-file-size`, export continues until the endpoint returns an empty page.

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

## Catalog Generation Limits

Catalog generation supports two optional limits.

Limit the number of data rows:

```bash
docker compose run --rm prepare-catalog --page-size 1000 --max-rows 10000
```

Limit the output file size:

```bash
docker compose run --rm prepare-catalog --page-size 1000 --max-file-size 10MB
```

Both options can be combined:

```bash
docker compose run --rm prepare-catalog \
  --page-size 1000 \
  --max-rows 100000 \
  --max-file-size 100MB
```

Export stops when the first configured limit is reached.

`--page-size` controls the number of rows requested from the SPARQL endpoint per page.

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