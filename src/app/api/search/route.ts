import { getPool } from "../../../../lib/db";

export const runtime = "nodejs";

const MAX_RESULTS = 20;
const MAX_METADATA_LENGTH = 80;
const MAX_METADATA_FIELDS = 4;

type SearchResult = {
  iri: string;
  label: string;
  typeLabel?: string | null;
  metadata: Record<string, string>;
};

type SearchRow = {
  iri: string;
  label: string;
  typeLabel: string | null;
  hasTypeLabel: boolean;
  metadata: Record<string, unknown>;
};

// Reading optional metadata through JSON avoids referencing a missing column.
// Deduplicate before LIMIT so repeated IRIs cannot consume result slots.
const PRIMARY_SEARCH = `
  WITH ranked AS (
    SELECT DISTINCT ON (e.iri)
      e.iri,
      e.label,
      to_jsonb(e) ->> 'typeLabel' AS "typeLabel",
      to_jsonb(e) ? 'typeLabel' AS "hasTypeLabel",
      to_jsonb(e) - ARRAY['iri', 'label', 'typeLabel', 'search_vector', 'search_text']::text[] AS metadata,
      CASE
        WHEN lower(e.label) = lower($1) THEN 1
        WHEN lower(e.label) LIKE lower($2) ESCAPE E'\\\\' THEN 2
        ELSE 3
      END AS priority,
      ts_rank_cd(e.search_vector, plainto_tsquery('simple', $1)) AS score
    FROM entity_search AS e
    WHERE lower(e.label) = lower($1)
       OR lower(e.label) LIKE lower($2) ESCAPE E'\\\\'
       OR e.search_vector @@ plainto_tsquery('simple', $1)
    ORDER BY e.iri, priority, score DESC, e.label
  )
  SELECT iri, label, "typeLabel", "hasTypeLabel", metadata
  FROM ranked
  ORDER BY priority, score DESC, lower(label), label, iri
  LIMIT $3
`;

const TRIGRAM_SEARCH = `
  WITH ranked AS (
    SELECT DISTINCT ON (e.iri)
      e.iri,
      e.label,
      to_jsonb(e) ->> 'typeLabel' AS "typeLabel",
      to_jsonb(e) ? 'typeLabel' AS "hasTypeLabel",
      to_jsonb(e) - ARRAY['iri', 'label', 'typeLabel', 'search_vector', 'search_text']::text[] AS metadata,
      word_similarity($1, e.search_text) AS score
    FROM entity_search AS e
    WHERE e.search_text %> $1
      AND NOT (e.iri = ANY($2::text[]))
    ORDER BY e.iri, score DESC, e.label
  )
  SELECT iri, label, "typeLabel", "hasTypeLabel", metadata
  FROM ranked
  ORDER BY score DESC, lower(label), label, iri
  LIMIT $3
`;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return Response.json({ results: [] });
  }

  try {
    const pool = getPool();
    // Treat LIKE wildcards as literal query characters.
    const prefix = query.replace(/[\\%_]/g, "\\$&") + "%";
    const primary = await pool.query<SearchRow>(PRIMARY_SEARCH, [
      query,
      prefix,
      MAX_RESULTS,
    ]);
    const rows = [...primary.rows];

    if (rows.length < MAX_RESULTS) {
      // Word similarity handles typos without diluting the score with the
      // unrelated IRI and metadata also stored in search_text. %> uses GIN.
      const fallback = await pool.query<SearchRow>(TRIGRAM_SEARCH, [
        query,
        rows.map((row) => row.iri),
        MAX_RESULTS - rows.length,
      ]);
      rows.push(...fallback.rows);
    }

    const results: SearchResult[] = rows.map((row) => ({
      iri: row.iri,
      label: row.label,
      ...(row.hasTypeLabel ? { typeLabel: row.typeLabel } : {}),
      metadata: Object.fromEntries(
        Object.entries(row.metadata)
          .filter(([, value]) =>
            typeof value === "string" || typeof value === "number" || typeof value === "boolean",
          )
          .map(([key, value]) => [key, String(value).trim()] as const)
          .filter(([, value]) => value.length > 0 && value.length <= MAX_METADATA_LENGTH)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(0, MAX_METADATA_FIELDS),
      ),
    }));

    return Response.json({ results });
  } catch (error) {
    console.error("Search database query failed", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
