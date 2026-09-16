"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EntityPanels from "@/components/EntityPanels";

type SearchResult = {
  iri: string;
  label: string;
  typeLabel?: string | null;
  metadata?: Record<string, string>;
};

type SearchState =
  | { status: "idle" | "loading" | "error" }
  | { status: "success"; results: SearchResult[]; nextCursor: string | null };

type SearchPage = { results: SearchResult[]; nextCursor: string | null };

export default function Search({ detailsEnabled = false }: { detailsEnabled?: boolean }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const moreRequestRef = useRef<AbortController | null>(null);
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
  const nextCursor = state.status === "success" ? state.nextCursor : null;
  const hasMore = nextCursor !== null;

  const loadMore = useCallback(async () => {
    if (!nextCursor || moreRequestRef.current) return;
    const controller = new AbortController();
    moreRequestRef.current = controller;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const response = await fetch(
        `/api/search?${new URLSearchParams({ q: query.trim(), limit: "20", cursor: nextCursor })}`,
        { signal: controller.signal, cache: "no-store" },
      );
      if (!response.ok) throw new Error("Search request failed");
      const data: SearchPage = await response.json();
      if (!controller.signal.aborted) {
        setState((current) => {
          if (current.status !== "success" || current.nextCursor !== nextCursor) return current;
          const results = new Map(current.results.map((result) => [result.iri, result]));
          for (const result of data.results) {
            if (!results.has(result.iri)) results.set(result.iri, result);
          }
          return { status: "success", results: Array.from(results.values()), nextCursor: data.nextCursor };
        });
      }
    } catch {
      if (!controller.signal.aborted) setMoreError(true);
    } finally {
      if (moreRequestRef.current === controller) {
        moreRequestRef.current = null;
        setLoadingMore(false);
      }
    }
  }, [query, nextCursor]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore || loadingMore || moreError || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void loadMore();
      }
    }, { rootMargin: "220px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, moreError, loadMore]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?${new URLSearchParams({ q: trimmedQuery, limit: "20" })}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error("Search request failed");

        const data: SearchPage = await response.json();
        if (!controller.signal.aborted) {
          setState({ status: "success", results: data.results, nextCursor: data.nextCursor });
        }
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
      moreRequestRef.current?.abort();
      moreRequestRef.current = null;
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
            requestRef.current?.abort();
            moreRequestRef.current?.abort();
            moreRequestRef.current = null;
            setLoadingMore(false);
            setMoreError(false);
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
              : `${state.results.length} result${state.results.length === 1 ? "" : "s"}${hasMore ? " loaded" : ""}`
          )}
        </p>
        {state.status === "success" && state.results.length > 0 && (
          <ul className="search-result-list" aria-label="Search results">
            {state.results.map((result) => (
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
                <EntityPanels iri={result.iri}
                  detailsOpen={detailsEnabled && openDetails.has(result.iri)}
                  describeOpen={openIris.has(result.iri)} />
              </li>
            ))}
          </ul>
        )}
        {state.status === "success" && resultCount > 0 && (
          <div ref={loadMoreRef} className="search-scroll-status">
            {hasMore ? (
              loadingMore ? <span role="status">Loading more…</span> : (
                <>
                  {moreError && <span role="alert">Could not load more results. </span>}
                  <button className="scroll-more" type="button" onClick={() => void loadMore()}>
                    {moreError ? "Try again" : "Load more"}
                  </button>
                </>
              )
            ) : <span role="status">End of results.</span>}
          </div>
        )}
      </div>
    </>
  );
}
