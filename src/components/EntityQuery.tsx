"use client";

import { useEffect, useMemo, useState } from "react";
import DescribeResultPanel from "./DescribeResultPanel";
import type { DescribeResponse } from "@/lib/describe-types";
import type { QueryButton, QueryResponse } from "@/lib/query-types";
import { collectMedia } from "@/lib/entityMedia";
import EntityMedia from "./EntityMedia";
import QueryResults from "./QueryResults";

type Props = { iri: string; button?: QueryButton };

export default function EntityQuery({ iri, button }: Props) {
  return <DescriptionBrowser key={JSON.stringify([iri, button?.id])} iri={iri} button={button} />;
}

function DescriptionBrowser({ iri, button }: Props) {
  const [history, setHistory] = useState<string[]>([iri]);
  const currentIri = history[history.length - 1];
  const [data, setData] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const syncTheme = () => setIsDark(document.documentElement.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const params = new URLSearchParams({ iri: currentIri });
        if (button) params.set("button", button.id);
        const response = await fetch(`/api/${button ? "query" : "describe"}?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Description request failed");
        const payload: QueryResponse | DescribeResponse = await response.json();
        if (!controller.signal.aborted) setData(button
          ? payload as QueryResponse
          : { kind: "rdf", data: payload as DescribeResponse });
      } catch {
        if (!controller.signal.aborted) setError("The query could not be loaded. Please try again shortly.");
      }
    }
    void load();
    return () => controller.abort();
  }, [currentIri, attempt, button]);

  function navigate(nextHistory: string[]) {
    setData(null);
    setError(null);
    setHistory(nextHistory);
  }

  const rdf = data?.kind === "rdf" ? data.data : null;
  const results = data?.kind === "results" ? data.data : null;
  const media = useMemo(() => collectMedia(currentIri, results, rdf?.quads ?? [], rdf?.iri ?? currentIri),
    [currentIri, results, rdf]);

  return (
    <>
      {results ? <QueryResults data={results} /> : <DescribeResultPanel
        title={button ? "Query results" : undefined}
        iri={currentIri}
        onDescribe={(nextIri) => {
          if (nextIri !== currentIri) navigate([...history, nextIri]);
        }}
        onBack={history.length > 1 ? () => navigate(history.slice(0, -1)) : undefined}
        isDark={isDark}
        loading={!data && !error}
        error={error}
        body={rdf?.body ?? ""}
        contentType={rdf?.contentType ?? ""}
        quads={rdf?.quads ?? []}
        prefixes={rdf?.prefixes ?? {}}
        parseError={rdf?.parseError ?? null}
      />}
      {error && <button className="result-details mt-3" type="button" onClick={() => {
        setError(null);
        setData(null);
        setAttempt((value) => value + 1);
      }}>Try again</button>}
      {(media.images.length > 0 || media.points.length > 0) &&
        <EntityMedia images={media.images} points={media.points} />}
    </>
  );
}
