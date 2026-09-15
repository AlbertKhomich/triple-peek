# Triple Peek — Quick Start

* Install:

  * Git
  * Docker
  * Docker Compose

* Clone the project:

```bash
git clone <YOUR_REPOSITORY_URL>
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

* Start everything:

```bash
docker compose up --build
```

* Open:

```text
http://localhost:3000
```

* Stop:

```bash
docker compose down
```

* Delete all PostgreSQL data and test from scratch:

```bash
docker compose down -v
docker compose up --build
