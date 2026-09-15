# Triple Peek — Quick Start

* Install:

  * Git
  * Docker
  * Docker Compose

* Clone the project:

```bash
git clone https://github.com/AlbertKhomich/TriplePeek
cd triple-peek
```

* Create environment file:

```bash
cp .env.example .env
```

* Put your CSV at:

```text
src/app/data/entities.csv
```

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

* Start PostgreSQL:

```bash
docker compose up -d db
```

* Import the CSV and create the search table/indexes:

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

The PostgreSQL data is preserved.

## Import Data Again

After changing the CSV:

```bash
docker compose run --rm seed
```

```bash
docker compose up -d --build app
```

## Delete PostgreSQL Data and Start From Scratch

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

With Docker, rebuild the app after changing `expand.sparql`:

```bash
docker compose up -d --build app
```
