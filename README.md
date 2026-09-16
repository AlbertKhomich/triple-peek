# TriplePeek — Quick Start

* Install:

  * Git
  * Docker
  * Docker Compose

* Clone the project:

```bash
git clone https://github.com/AlbertKhomich/triple-peek
cd triple-peek
```

* Create environment file:

Specify your SPARQL endpoint in `.env`.

```bash
cp .env.example .env
```

* Let search engine know what we search for. Put your CSV with keywords at:

```text
src/app/data/entities.csv
```

Update the path in `.env`.

* CSV must contain at least:

```csv
iri,label
http://www.wikidata.org/entity/Q183,Germany
http://www.wikidata.org/entity/Q142,France
```

## First Setup

* Build the containers:

```bash
docker compose build
```

* Start search engine:

```bash
docker compose up -d db
```

* Feed keywords to search engine:

```bash
docker compose run --rm seed
```

* Start the application:

```bash
docker compose up -d app
```

* Open:

```text
http://localhost:3000
```

## Normal Start

Once the database has already been seeded:

```bash
docker compose up -d db app
```

This does **not** run the seed process again.

## Stop

```bash
docker compose down
```

The keyword data for search engine is preserved.

## Import Data Again or add new bunch

After changing the CSV:

```bash
docker compose run --rm seed
```

```bash
docker compose up -d --build app
```

## Delete keywords for search engine Data and Start From Scratch

Prepare new keywords.

```bash
docker compose down -v
docker compose up -d db
docker compose run --rm seed
docker compose up -d app
```
## Optional Details Query (`expand.sparql`)

Add `src/app/data/expand.sparql` to enable a **Details** button.

Use `<${iri}>` for the selected entity:

```sparql
PREFIX schema: <http://schema.org/>

SELECT ?name
WHERE {
  VALUES ?entity { <${iri}> }
  ?entity schema:name ?name .
  FILTER(LANG(?name) IN ("en", "ru", "uk", "de"))
}
```
It works with W3C standard SPARQL JSON result format.

With Docker, rebuild the app after changing `expand.sparql`:

```bash
docker compose up -d --build app
```
