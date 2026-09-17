"use client";

import EntityQuery from "./EntityQuery";
import type { QueryButton } from "@/lib/query-types";

export default function EntityPanels({ iri, buttons, describeOpen }: {
  iri: string; buttons: QueryButton[]; describeOpen: boolean;
}) {
  return (
    <>
      {buttons.map((button) => <section key={button.id}
        id={`query-${encodeURIComponent(iri)}-${encodeURIComponent(button.id)}`}
        aria-label={button.label} className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-600">
        <h3 className="mb-2 text-sm font-semibold">{button.label}</h3>
        <EntityQuery iri={iri} button={button} />
      </section>)}
      {describeOpen && <div id={`description-${encodeURIComponent(iri)}`} className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-600">
        <EntityQuery iri={iri} />
      </div>}
    </>
  );
}
