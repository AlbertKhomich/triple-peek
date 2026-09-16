"use client";

import { useEffect, useState } from "react";
import DescribeResultPanel from "./DescribeResultPanel";
import type { DescribeResponse } from "@/lib/describe-types";

type Props = { iri: string; onData: (data: DescribeResponse | null) => void };

export default function EntityDescription({ iri, onData }: Props) {
  return <DescriptionBrowser key={iri} iri={iri} onData={onData} />;
}

function DescriptionBrowser({ iri, onData }: Props) {
  const [history, setHistory] = useState<string[]>([iri]);
  const currentIri = history[history.length - 1];
  const [data, setData] = useState<DescribeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    onData(data);
    return () => onData(null);
  }, [data, onData]);

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
        const response = await fetch(`/api/describe?${new URLSearchParams({ iri: currentIri })}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Description request failed");
        const payload: DescribeResponse = await response.json();
        if (!controller.signal.aborted) setData(payload);
      } catch {
        if (!controller.signal.aborted) setError("The description could not be loaded. Please try again shortly.");
      }
    }
    void load();
    return () => controller.abort();
  }, [currentIri, attempt]);

  function navigate(nextHistory: string[]) {
    setData(null);
    setError(null);
    setHistory(nextHistory);
  }

  return (
    <>
      <DescribeResultPanel
        iri={currentIri}
        onDescribe={(nextIri) => {
          if (nextIri !== currentIri) navigate([...history, nextIri]);
        }}
        onBack={history.length > 1 ? () => navigate(history.slice(0, -1)) : undefined}
        isDark={isDark}
        loading={!data && !error}
        error={error}
        body={data?.body ?? ""}
        contentType={data?.contentType ?? ""}
        quads={data?.quads ?? []}
        prefixes={data?.prefixes ?? {}}
        parseError={data?.parseError ?? null}
      />
      {error && <button className="result-details mt-3" type="button" onClick={() => {
        setError(null);
        setData(null);
        setAttempt((value) => value + 1);
      }}>Try again</button>}
    </>
  );
}
