"use client";

import { useMemo, useState } from "react";
import EntityDetails from "./EntityDetails";
import EntityDescription from "./EntityDescription";
import EntityMedia from "./EntityMedia";
import type { SparqlResults } from "@/lib/sparql-results";
import type { DescribeResponse } from "@/lib/describe-types";
import { collectMedia } from "@/lib/entityMedia";

export default function EntityPanels({ iri, detailsOpen, describeOpen }: {
  iri: string; detailsOpen: boolean; describeOpen: boolean;
}) {
  const [details, setDetails] = useState<SparqlResults | null>(null);
  const [description, setDescription] = useState<DescribeResponse | null>(null);
  const media = useMemo(() => collectMedia(
    iri, detailsOpen ? details : null,
    describeOpen ? description?.quads ?? [] : [], description?.iri ?? iri,
  ), [iri, detailsOpen, describeOpen, details, description]);
  return (
    <>
      {detailsOpen && <div id={`details-${encodeURIComponent(iri)}`} className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-600">
        <EntityDetails iri={iri} onData={setDetails} />
      </div>}
      {describeOpen && <div id={`description-${encodeURIComponent(iri)}`} className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-600">
        <EntityDescription iri={iri} onData={setDescription} />
      </div>}
      {(media.images.length > 0 || media.points.length > 0) &&
        <EntityMedia images={media.images} points={media.points} />}
    </>
  );
}
