"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SearchResult = {
  iri: string;
  label: string;
  typeLabel?: string | null;
  metadata?: Record<string, string>;
};

type SearchState =
  | { status: "idle" | "loading" | "error" }
  | { status: "success"; results: SearchResult[] };

export default function Search() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?${new URLSearchParams({ q: trimmedQuery })}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error("Search request failed");

        const data: { results: SearchResult[] } = await response.json();
        if (!controller.signal.aborted) {
          setState({ status: "success", results: data.results });
        }
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <>
      <div className="search-field" role="search">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.2" />
          <path d="m15.2 15.2 5 5" />
        </svg>
        <input
          type="search"
          aria-label="Search papers"
          aria-controls="search-results"
          placeholder="Search by label or keyword..."
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setState({ status: value.trim() ? "loading" : "idle" });
          }}
        />
      </div>
      <div id="search-results" className={state.status === "idle" ? undefined : "search-results"}>
        <p className="search-status" role="status" aria-live="polite" aria-atomic="true">
          {state.status === "loading" && "Searching…"}
          {state.status === "error" && "Search is unavailable right now. Please try again shortly."}
          {state.status === "success" && (
            state.results.length === 0
              ? "No results found. Try another label or keyword."
              : `${state.results.length} result${state.results.length === 1 ? "" : "s"}`
          )}
        </p>
        {state.status === "success" && state.results.length > 0 && (
          <ul className="search-result-list" aria-label="Search results">
            {state.results.map((result) => (
              <li className="search-result" key={result.iri}>
                <div className="search-result-heading">
                  <h2>
                    <Link className="search-result-link" href={`/entity?${new URLSearchParams({ iri: result.iri, label: result.label })}`} prefetch={false}>
                      {result.label}
                    </Link>
                  </h2>
                  {result.typeLabel?.trim() && result.typeLabel.trim().length <= 80 && (
                    <span className="search-result-type">{result.typeLabel.trim()}</span>
                  )}
                </div>
                <Link className="search-result-iri" href={`/entity?${new URLSearchParams({ iri: result.iri, label: result.label })}`} prefetch={false}>
                  {result.iri}
                </Link>
                {result.metadata && Object.keys(result.metadata).length > 0 && (
                  <dl className="search-result-metadata">
                    {Object.entries(result.metadata).map(([name, value]) => (
                      <div key={name}>
                        <dt>{name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ")}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
