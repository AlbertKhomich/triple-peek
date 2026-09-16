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
  return <span className="whitespace-pre-wrap">{binding.value}</span>;
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
  const categories = variables.map((variable) => {
    const values = new Map<string, SparqlBinding>();
    for (const row of rows) {
      const binding = row[variable];
      if (!binding) continue;
      const key = JSON.stringify([binding.type, binding.value, binding["xml:lang"], binding.datatype]);
      if (!values.has(key)) values.set(key, binding);
    }
    return { variable, values: Array.from(values.values()) };
  });

  return (
    <section className="space-y-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300 [overflow-wrap:anywhere]" aria-label="Entity details">
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
          <dl className="space-y-1.5">
            {categories.map(({ variable, values }) => {
              const label = variable.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
              const isAbstract = variable.toLowerCase() === "abstract";
              return (
                <div key={variable}>
                  <dt className={`${isAbstract ? "block mb-1" : "inline"} font-medium`}>
                    {label.charAt(0).toUpperCase() + label.slice(1)}:
                  </dt>{" "}
                  <dd className={isAbstract ? "m-0" : "m-0 inline"}>
                    {values.length === 0 ? <Binding /> : values.map((binding, index) => (
                      <span key={index} className={isAbstract ? "block mb-2 last:mb-0" : undefined}>
                        {!isAbstract && index > 0 && "; "}
                        <Binding binding={binding} />
                      </span>
                    ))}
                  </dd>
                </div>
              );
            })}
          </dl>
      ))}
    </section>
  );
}
