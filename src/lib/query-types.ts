import type { DescribeResponse } from "./describe-types";
import type { SparqlResults } from "./sparql-results";

export type QueryButton = { id: string; label: string };
export type QueryResponse =
  | { kind: "results"; data: SparqlResults }
  | { kind: "rdf"; data: DescribeResponse };
