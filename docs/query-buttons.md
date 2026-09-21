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

The search catalog can therefore remain intentionally small and optimized for discovery even when the underlying knowledge graph contains billions of triples.