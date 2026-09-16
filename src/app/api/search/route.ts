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
  priority: number;
  score: number;
  sortLabel: string;
  iri: string;
  label: string;
  typeLabel: string | null;
  hasTypeLabel: boolean;
  metadata: Record<string, unknown>;
};

// Reading optional metadata through JSON avoids referencing a missing column.
// Deduplicate before LIMIT so repeated IRIs cannot consume result slots.
const SEARCH = `
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
        WHEN e.search_vector @@ plainto_tsquery('simple', $1) THEN 3
        ELSE 4
      END AS priority,
      (CASE WHEN lower(e.label) = lower($1)
                   OR lower(e.label) LIKE lower($2) ESCAPE E'\\\\'
                   OR e.search_vector @@ plainto_tsquery('simple', $1)
        THEN ts_rank_cd(e.search_vector, plainto_tsquery('simple', $1))
        ELSE word_similarity($1, e.search_text)
      END)::double precision AS score
    FROM entity_search AS e
    WHERE lower(e.label) = lower($1)
       OR lower(e.label) LIKE lower($2) ESCAPE E'\\\\'
       OR e.search_vector @@ plainto_tsquery('simple', $1)
       OR e.search_text %> $1
    ORDER BY e.iri, priority, score DESC, e.label
  )
  SELECT iri, label, "typeLabel", "hasTypeLabel", metadata, priority, score, lower(label) AS "sortLabel"
  FROM ranked
  WHERE $4::integer IS NULL OR
    (priority, -score, lower(label), label, iri) >
    ($4::integer, -$5::double precision, $6::text, $7::text, $8::text)
  ORDER BY priority, score DESC, lower(label), label, iri
  LIMIT $3
`;

type Cursor = { query: string; priority: number; score: number; sortLabel: string; label: string; iri: string };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const limit = Number(params.get("limit") ?? MAX_RESULTS);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS) {
    return Response.json({ error: "Invalid page size" }, { status: 400 });
  }
  let cursor: Cursor | null = null;
  if (params.has("cursor")) {
    try {
      const raw = params.get("cursor")!;
      if (raw.length > 16384) throw new Error("Invalid cursor");
      cursor = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
      if (!cursor || cursor.query !== query || !Number.isInteger(cursor.priority) ||
          cursor.priority < 1 || cursor.priority > 4 || !Number.isFinite(cursor.score) ||
          typeof cursor.sortLabel !== "string" || typeof cursor.label !== "string" || typeof cursor.iri !== "string") {
        throw new Error("Invalid cursor");
      }
    } catch {
      return Response.json({ error: "Invalid search cursor" }, { status: 400 });
    }
  }

  if (!query) {
    return Response.json({ results: [], nextCursor: null });
  }

  try {
    const pool = getPool();
    // Treat LIKE wildcards as literal query characters.
    const prefix = query.replace(/[\\%_]/g, "\\$&") + "%";
    const page = await pool.query<SearchRow>(SEARCH, [
      query,
      prefix,
      limit + 1,
      cursor?.priority ?? null,
      cursor?.score ?? null,
      cursor?.sortLabel ?? null,
      cursor?.label ?? null,
      cursor?.iri ?? null,
    ]);
    const rows = page.rows.slice(0, limit);
    const last = rows.at(-1);
    const nextCursor = page.rows.length > limit && last
      ? Buffer.from(JSON.stringify({ query, priority: last.priority, score: last.score,
          sortLabel: last.sortLabel, label: last.label, iri: last.iri } satisfies Cursor)).toString("base64url")
      : null;

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

    return Response.json({ results, nextCursor });
  } catch (error) {
    console.error("Search database query failed", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
