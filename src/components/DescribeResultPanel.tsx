"use client";

import { type ReactNode } from "react";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import type { DescribeQuad, DescribeTerm } from "@/lib/describe-types";

type DescribeResultPanelProps = {
  body: string;
  contentType: string;
  error: string | null;
  iri: string;
  isDark: boolean;
  loading: boolean;
  parseError: string | null;
  prefixes: Record<string, string>;
  quads: DescribeQuad[];
  onDescribe: (iri: string) => void;
  onBack?: () => void;
};

type PrefixMap = Record<string, string>;
type PrefixEntry = { prefix: string; iriBase: string };

const BUILTIN_PREFIXES: PrefixMap = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  schema: "https://schema.org/",
};
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";

function normalizeHttpHref(input: string): string | null {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parsePrefixes(input: string): PrefixMap {
  const out: PrefixMap = {};
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const ttlMatch = line.match(/^\s*@prefix\s+([A-Za-z][\w-]*|)\s*:\s*<([^>]+)>/i);
    if (ttlMatch) {
      const key = (ttlMatch[1] ?? "").trim();
      const href = normalizeHttpHref((ttlMatch[2] ?? "").trim());
      if (href) out[key] = href;
      continue;
    }

    const sparqlMatch = line.match(/^\s*prefix\s+([A-Za-z][\w-]*|)\s*:\s*<([^>]+)>/i);
    if (sparqlMatch) {
      const key = (sparqlMatch[1] ?? "").trim();
      const href = normalizeHttpHref((sparqlMatch[2] ?? "").trim());
      if (href) out[key] = href;
    }
  }

  return out;
}

function toSortedPrefixEntries(prefixes: PrefixMap): PrefixEntry[] {
  return Object.entries(prefixes)
    .filter(([, iriBase]) => !!normalizeHttpHref(iriBase))
    .map(([prefix, iriBase]) => ({ prefix, iriBase }))
    .sort((a, b) => b.iriBase.length - a.iriBase.length);
}

function compactIri(iri: string, entries: PrefixEntry[]): string {
  for (const entry of entries) {
    if (!iri.startsWith(entry.iriBase)) continue;
    const local = iri.slice(entry.iriBase.length);
    if (!local) continue;
    return entry.prefix ? `${entry.prefix}:${local}` : `:${local}`;
  }
  return iri;
}

function renderNamedNode(iri: string, entries: PrefixEntry[], isDark: boolean, onDescribe: (iri: string) => void): ReactNode {
  const href = normalizeHttpHref(iri);
  const label = compactIri(iri, entries);

  const linkClass = isDark ? "break-all text-cyan-300 underline" : "break-all text-cyan-700 underline";
  return (
    <>
      <button
        type="button"
        className={`${linkClass} cursor-pointer text-left`}
        onClick={() => onDescribe(iri)}
        title={`Describe ${iri}`}
      >
        {label}
      </button>
      {href && (
        <a
          className={`${linkClass} ml-1`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${iri} externally`}
          title="Open externally"
        >
          <FaExternalLinkSquareAlt className="inline-block align-text-bottom" aria-hidden="true" />
        </a>
      )}
    </>
  );
}

function renderTerm(term: DescribeTerm, entries: PrefixEntry[], isDark: boolean, onDescribe: (iri: string) => void): ReactNode {
  if (term.termType === "NamedNode") return renderNamedNode(term.value, entries, isDark, onDescribe);
  if (term.termType === "BlankNode") return <span className={isDark ? "text-gray-300" : "text-gray-700"}>_:{term.value}</span>;
  if (term.termType === "DefaultGraph") return <span className={isDark ? "text-gray-400" : "text-gray-500"}>default</span>;

  const hasDatatype = !!term.datatype && term.datatype !== XSD_STRING;
  const hasLanguage = !!term.language;
  return (
    <span className="break-words">
      <span className={isDark ? "text-amber-300" : "text-amber-700"}>
        {'"'}
        {term.value}
        {'"'}
      </span>
      {hasLanguage ? <span className={isDark ? "text-gray-300" : "text-gray-700"}>@{term.language}</span> : null}
      {hasDatatype && term.datatype ? (
        <span className={isDark ? "text-gray-300" : "text-gray-700"}>
          ^^{renderNamedNode(term.datatype, entries, isDark, onDescribe)}
        </span>
      ) : null}
    </span>
  );
}

export default function DescribeResultPanel(props: DescribeResultPanelProps) {
  const {
    body,
    contentType,
    error,
    iri,
    isDark,
    loading,
    parseError,
    prefixes,
    quads,
    onDescribe,
    onBack,
  } = props;
  const rawPrefixes = parsePrefixes(body);
  const effectivePrefixes = {
    ...BUILTIN_PREFIXES,
    ...rawPrefixes,
    ...(prefixes ?? {}),
  };
  const prefixEntries = toSortedPrefixEntries(effectivePrefixes);
  const hasNamedGraph = quads.some((quad) => !!quad.graph && quad.graph.termType !== "DefaultGraph");

  return (
    <section
      className={`mt-4 rounded-xl border p-4 ${
        isDark ? "border-gray-600 bg-gray-900/40" : "border-gray-200 bg-gray-50"
      }`}
      aria-live="polite"
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {onBack && <button type="button" className="result-details cursor-pointer" onClick={onBack}>← Back</button>}
        <h2 className="text-base font-semibold">Resource Description (DESCRIBE)</h2>
        <a className="text-sm underline break-all" href={normalizeHttpHref(iri) ?? undefined} target="_blank" rel="noopener noreferrer">
          {iri}
        </a>
      </div>

      {loading ? <div className="text-sm">Loading resource description...</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {!loading && !error ? (
        <>
          {contentType ? (
            <div className={isDark ? "mb-2 text-xs text-gray-400" : "mb-2 text-xs text-gray-600"}>
              Content type: {contentType}
            </div>
          ) : null}
          {parseError ? (
            <div className={isDark ? "mb-2 text-xs text-amber-300" : "mb-2 text-xs text-amber-700"}>
              The response could not be displayed as RDF triples.
            </div>
          ) : null}
          {quads.length > 0 ? (
            <div className="space-y-2">
              <div className={isDark ? "text-xs text-gray-400" : "text-xs text-gray-600"}>
                {quads.length} triple{quads.length === 1 ? "" : "s"}
              </div>
              <div
                className={`max-h-[420px] overflow-auto rounded-lg border ${
                  isDark ? "border-gray-700 bg-black/40" : "border-gray-200 bg-white"
                }`}
              >
                <table className="w-full min-w-[820px] table-fixed border-collapse text-xs">
                  <colgroup>
                    {hasNamedGraph ? (
                      <>
                        <col style={{ width: "24%" }} />
                        <col style={{ width: "24%" }} />
                        <col style={{ width: "36%" }} />
                        <col style={{ width: "16%" }} />
                      </>
                    ) : (
                      <>
                        <col style={{ width: "28%" }} />
                        <col style={{ width: "28%" }} />
                        <col style={{ width: "44%" }} />
                      </>
                    )}
                  </colgroup>
                  <thead className={isDark ? "bg-gray-800/70 text-gray-200" : "bg-gray-100 text-gray-700"}>
                    <tr>
                      <th className="border-b border-inherit px-3 py-2 text-left font-medium">Subject</th>
                      <th className="border-b border-inherit px-3 py-2 text-left font-medium">Predicate</th>
                      <th className="border-b border-inherit px-3 py-2 text-left font-medium">Object</th>
                      {hasNamedGraph ? (
                        <th className="border-b border-inherit px-3 py-2 text-left font-medium">Graph</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {quads.map((quad, idx) => (
                      <tr key={`quad-${idx}`} className={isDark ? "border-t border-gray-700" : "border-t border-gray-200"}>
                        <td className="align-top px-3 py-2 whitespace-normal break-words">
                          {renderTerm(quad.subject, prefixEntries, isDark, onDescribe)}
                        </td>
                        <td className="align-top px-3 py-2 whitespace-normal break-words">
                          {renderTerm(quad.predicate, prefixEntries, isDark, onDescribe)}
                        </td>
                        <td className="align-top px-3 py-2 whitespace-normal break-words">
                          {renderTerm(quad.object, prefixEntries, isDark, onDescribe)}
                        </td>
                        {hasNamedGraph ? (
                          <td className="align-top px-3 py-2 whitespace-normal break-words">
                            {quad.graph ? renderTerm(quad.graph, prefixEntries, isDark, onDescribe) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          ) : (
            <p className="text-sm">
              {parseError ? "No triples available to display." : /json|xml/i.test(contentType) && body.trim() ? "This response format cannot be displayed as a table." : "No triples returned for this resource."}
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
