# Configuration

Copy the example environment file before starting TriplePeek:

```bash
cp .env.example .env
```

Docker Compose reads the values from `.env`.

## Environment variables

| Variable | Purpose | Bundled demo value |
| --- | --- | --- |
| `POSTGRES_DB` | PostgreSQL database name | `triplepeek` |
| `POSTGRES_USER` | PostgreSQL user | `triplepeek` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `triplepeek` |
| `DATABASE_URL` | Connection string used by the application and importer | `postgresql://triplepeek:triplepeek@db:5432/triplepeek` |
| `CSV_FILE` | Catalog path inside the container, used by the generator and importer | `/src/app/data/entities.csv` |
| `SEARCH_TABLE` | Target table used by the importer; keep the default for the bundled application | `entity_search` |
| `SPARQL_ENDPOINT` | Endpoint used for live queries and catalog generation | `https://wikidata.data.dice-research.org/sparql` |

Keep `DATABASE_URL` consistent with the PostgreSQL credentials. The hostname `db` refers to the database service inside Docker Compose.

## Use your own knowledge graph

Set your endpoint and catalog path in `.env`:

```env
SPARQL_ENDPOINT=https://example.org/sparql
CSV_FILE=/src/app/data/search-catalog.csv
```

The host directory `src/app/data/` is mounted at `/src/app/data/` in the catalog generator and importer containers.

- Edit `src/app/data/create-catalog.sparql` to [generate your catalog](catalog-generation.md), or provide a [catalog CSV](search-catalog.md) manually.
- Configure `.sparql` files in `src/app/data/buttons/` for your endpoint; see [Query Buttons](query-buttons.md).
- [Import the catalog](catalog-generation.md#import-the-search-catalog) before searching it.

Apply application configuration and query template changes with:

```bash
docker compose up -d --build app
```

## Documentation site

The documentation is configured in `mkdocs.yml`. To preview it locally:

```bash
python -m pip install mkdocs-material
python -m mkdocs serve
```

Open the local URL printed by MkDocs. To build the static site:

```bash
python -m mkdocs build
```

The generated `site/` directory is ignored by Git.

The `.github/workflows/docs.yml` workflow publishes the site to the `gh-pages` branch on pushes to `main`, and can also be run manually. In the repository's **Settings → Pages**, select **Deploy from a branch**, then choose **gh-pages** and **/ (root)** after the first successful deployment.
