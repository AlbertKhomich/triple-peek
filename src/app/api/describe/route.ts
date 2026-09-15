import { describeEntityResponse, isValidIri } from "../../../../lib/sparql";
import { parseDescribeBodyWithN3 } from "@/lib/rdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const iri = new URL(request.url).searchParams.get("iri")?.trim() ?? "";
  if (!isValidIri(iri)) {
    return Response.json({ error: "Missing or invalid IRI" }, { status: 400 });
  }

  try {
    const response = await describeEntityResponse(iri);
    const parsed = parseDescribeBodyWithN3(response.body, response.contentType);
    return Response.json({ iri, ...response, ...parsed });
  } catch (error) {
    console.error("Unable to describe entity", error);
    return Response.json({ error: "The description could not be loaded. Please try again shortly." }, { status: 500 });
  }
}
