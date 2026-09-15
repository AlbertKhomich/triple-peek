"use client";

import { useEffect, useState } from "react";
import { isSparqlResults, type SparqlBinding, type SparqlResults } from "@/lib/sparql-results";

function Binding({ binding }: { binding?: SparqlBinding }) {
  if (!binding) return <span className="text-gray-500">—</span>;
  if (binding.type === "uri") {
    return /^https?:\/\//i.test(binding.value)
      ? <a href={binding.value} className="break-all text-cyan-700 underline dark:text-cyan-300" target="_blank" rel="noopener noreferrer">{binding.value}</a>
      : <span className="break-all">{binding.value}</span>;
  }
  if (binding.type === "bnode") return <span>_:{binding.value}</span>;
  return (
    <span className="whitespace-pre-wrap break-words">
      <span className="text-amber-700 dark:text-amber-300">{binding.value}</span>
      {binding["xml:lang"] && <span className="ml-1 text-gray-500 dark:text-gray-400">@{binding["xml:lang"]}</span>}
      {binding.datatype && !binding["xml:lang"] && binding.datatype !== "http://www.w3.org/2001/XMLSchema#string" && (
        <span className="block break-all text-gray-500 dark:text-gray-400">{binding.datatype}</span>
      )}
    </span>
  );
}

export default function EntityDetails({ iri }: { iri: string }) {
  const [data, setData] = useState<SparqlResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/details?${new URLSearchParams({ iri })}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Details request failed");
        const payload: unknown = await response.json();
        if (!isSparqlResults(payload)) throw new Error("Invalid SPARQL results");
        if (!controller.signal.aborted) setData(payload);
      } catch {
        if (!controller.signal.aborted) setError("Details could not be loaded. Please try again shortly.");
      }
    }
    void load();
    return () => controller.abort();
  }, [iri, attempt]);

  const variables = data?.head.vars ?? [];
  const rows = data?.results?.bindings ?? [];

  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-900/40" aria-label="Entity details">
      <h2 className="mb-2 text-base font-semibold">Details</h2>
      {!data && !error && <p className="text-sm" role="status">Loading details…</p>}
      {error && <div role="alert" className="text-sm">
        <p>{error}</p>
        <button className="result-details mt-3 cursor-pointer" type="button" onClick={() => {
          setError(null);
          setData(null);
          setAttempt((value) => value + 1);
        }}>Try again</button>
      </div>}
      {data && (typeof data.boolean === "boolean" ? (
        <p className="text-sm">{data.boolean ? "True" : "False"}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm">No details returned for this entity.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{rows.length} result{rows.length === 1 ? "" : "s"}</p>
          <div className="max-h-[420px] overflow-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-black/40">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800/70 dark:text-gray-200">
                <tr>{variables.map((variable) => <th key={variable} scope="col" className="px-3 py-2 font-medium">{variable}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, index) => <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                  {variables.map((variable) => <td key={variable} className="min-w-32 max-w-lg px-3 py-2 align-top"><Binding binding={row[variable]} /></td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
        </>
      ))}
    </section>
  );
}
