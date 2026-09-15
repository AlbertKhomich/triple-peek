"use client";

import { useEffect, useState } from "react";
import DescribeResultPanel from "./DescribeResultPanel";
import type { DescribeResponse } from "@/lib/describe-types";

export default function EntityDescription({ iri }: { iri: string }) {
  const [data, setData] = useState<DescribeResponse | null>(null);
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
        const response = await fetch(`/api/describe?${new URLSearchParams({ iri })}`, {
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
  }, [iri, attempt]);

  return (
    <>
      <DescribeResultPanel
        iri={iri}
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
