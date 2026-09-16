"use client";

import { useEffect, useRef, useState } from "react";
import EntityDescription from "@/components/EntityDescription";
import EntityDetails from "@/components/EntityDetails";

type SearchResult = {
  iri: string;
  label: string;
  typeLabel?: string | null;
  metadata?: Record<string, string>;
};

type SearchState =
  | { status: "idle" | "loading" | "error" }
  | { status: "success"; results: SearchResult[] };

export default function Search({ detailsEnabled = false }: { detailsEnabled?: boolean }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [visibleCount, setVisibleCount] = useState(8);
  const [openIris, setOpenIris] = useState<Set<string>>(new Set());
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  function toggleExpand(iri: string) {
    setOpenDetails((current) => {
      const next = new Set(current);
      if (next.has(iri)) next.delete(iri);
      else next.add(iri);
      return next;
    });
  }
  function toggleDescribe(iri: string) {
    setOpenIris((current) => {
      const next = new Set(current);
      if (next.has(iri)) next.delete(iri);
      else next.add(iri);
      return next;
    });
  }
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const resultCount = state.status === "success" ? state.results.length : 0;
  const hasMore = visibleCount < resultCount;

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount((count) => Math.min(count + 8, resultCount));
      }
    }, { rootMargin: "220px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, resultCount, visibleCount]);

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
        <input
          type="search"
          aria-label="Search papers"
          aria-controls="search-results"
          placeholder="Search by label and keywords..."
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setVisibleCount(8);
            setOpenIris(new Set());
            setOpenDetails(new Set());
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
            {state.results.slice(0, visibleCount).map((result) => (
              <li className="search-result" key={result.iri}>
                <div className="search-result-top">
                  <div className="search-result-body">
                    <div className="search-result-heading">
                      <h2>
                        <button type="button" className="search-result-link text-left cursor-pointer" onClick={() => toggleDescribe(result.iri)} aria-expanded={openIris.has(result.iri)}>
                          {result.label}
                        </button>
                      </h2>
                      {result.typeLabel?.trim() && result.typeLabel.trim().length <= 80 && (
                        <span className="search-result-type">{result.typeLabel.trim()}</span>
                      )}
                    </div>
                    <button type="button" className="search-result-iri text-left cursor-pointer" onClick={() => toggleDescribe(result.iri)} aria-expanded={openIris.has(result.iri)}>
                      {result.iri}
                    </button>
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
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    {detailsEnabled && <button type="button" className="result-details cursor-pointer" onClick={() => toggleExpand(result.iri)} aria-expanded={openDetails.has(result.iri)} aria-controls={`details-${encodeURIComponent(result.iri)}`}>
                      {openDetails.has(result.iri) ? "Hide details" : "Details"}
                    </button>}
                    <button type="button" className="result-details cursor-pointer" onClick={() => toggleDescribe(result.iri)} aria-expanded={openIris.has(result.iri)} aria-controls={`description-${encodeURIComponent(result.iri)}`}>
                      {openIris.has(result.iri) ? "Hide describe" : "Describe"}
                    </button>
                  </div>
                </div>
                {detailsEnabled && openDetails.has(result.iri) && (
                  <div id={`details-${encodeURIComponent(result.iri)}`} className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-600">
                    <EntityDetails iri={result.iri} />
                  </div>
                )}
                {openIris.has(result.iri) && (
                  <div id={`description-${encodeURIComponent(result.iri)}`} className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-600">
                    <EntityDescription iri={result.iri} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {state.status === "success" && resultCount > 0 && (
          <div ref={loadMoreRef} className="search-scroll-status">
            {hasMore ? (
              <button className="scroll-more" type="button" onClick={() => setVisibleCount((count) => Math.min(count + 8, resultCount))}>
                Scroll to load more
              </button>
            ) : <span role="status">End of results.</span>}
          </div>
        )}
      </div>
    </>
  );
}
