"use client";

import { type SparqlBinding, type SparqlResults } from "@/lib/sparql-results";
import LinkedText from "./LinkedText";

function Binding({ binding }: { binding: SparqlBinding }) {
  if (binding.type === "uri") {
    return /^https?:\/\//i.test(binding.value)
      ? <a href={binding.value} className="break-all text-cyan-700 underline dark:text-cyan-300" target="_blank" rel="noopener noreferrer">{binding.value}</a>
      : <span className="break-all">{binding.value}</span>;
  }
  if (binding.type === "bnode") return <span>_:{binding.value}</span>;
  return <span className="whitespace-pre-wrap"><LinkedText text={binding.value} /></span>;
}

export default function QueryResults({ data }: { data: SparqlResults }) {
  const variables = data?.head.vars ?? [];
  const rows = data?.results?.bindings ?? [];
  const categories = variables.map((variable) => {
    const values = new Map<string, SparqlBinding>();
    for (const row of rows) {
      const binding = row[variable];
      if (!binding?.value.trim()) continue;
      const key = JSON.stringify([binding.type, binding.value, binding["xml:lang"], binding.datatype]);
      if (!values.has(key)) values.set(key, binding);
    }
    return { variable, values: Array.from(values.values()) };
  }).filter(({ values }) => values.length > 0);

  return (
    <section className="space-y-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300 [overflow-wrap:anywhere]" aria-label="Query results">
      {data && (typeof data.boolean === "boolean" ? (
        <p className="text-sm">{data.boolean ? "True" : "False"}</p>
      ) : categories.length === 0 ? (
        <p className="text-sm">No results returned for this entity.</p>
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
                    {values.map((binding, index) => (
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
