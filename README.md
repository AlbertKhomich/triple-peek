<img width="1771" height="952" alt="Screenshot 2026-09-16 at 15 29 52" src="https://github.com/user-attachments/assets/de1bccb6-fac9-4a21-afc8-902ab4523114" />

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

* Create the environment file:

```bash
cp .env.example .env
```

Specify your SPARQL endpoint in `.env`.

* Tell the search engine what to search for. Put your CSV with keywords at:

```text
src/app/data/entities.csv
```

Update the path in `.env` if necessary.

* The CSV must contain at least:

```csv
iri,label,typeLabel,country
http://www.wikidata.org/entity/Q4152,Neuschwanstein Castle,museum | castle | château | tourist attraction | palace,Germany
http://www.wikidata.org/entity/Q12874774,Castle of Didymoteicho,castle | military base,Greece
```

## First Setup

* Build the containers:

```bash
docker compose build
```

* Start the search engine:

```bash
docker compose up -d db
```

* Feed keywords to the search engine:

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

Once the search engine has already been seeded:

```bash
docker compose up -d db app
```

This does **not** run the seed process again.

## Stop

```bash
docker compose down
```

The search engine keyword data is preserved.

## Add a New Batch of keywords

Prepare the new CSV file with keywords.

```bash
docker compose down
docker compose up -d db
docker compose run --rm seed
docker compose up -d app
```

## Delete Search Engine Data and Start From Scratch

Prepare the new keywords.

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

It works with the W3C standard SPARQL JSON result format.

With Docker, rebuild the app after changing `expand.sparql`:

```bash
docker compose up -d --build app
```
