# Search Catalog

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

TriplePeek gives special treatment to the third column when it is named `typeLabel`.

If `typeLabel` is non-empty and at most 80 characters long, it is displayed as a badge beside the result heading.

Other metadata columns are displayed below the heading and IRI as name/value pairs.

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

For more precise search behavior, you can create the catalog manually instead of generating it automatically. This is useful when you want to carefully choose, combine, or enrich search terms for your dataset.

