import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("custom query discovery and API", async (t) => {
  const originalCwd = process.cwd();
  const originalEndpoint = process.env.SPARQL_ENDPOINT;
  const originalFetch = globalThis.fetch;
  const fixture = await mkdtemp(path.join(os.tmpdir(), "triple-peek-buttons-"));
  process.chdir(fixture);
  try {
    const { listQueryButtons, readButtonQuery, queryForm } = await import("../lib/query-buttons");
    const { GET } = await import("../src/app/api/query/route");
    const directory = path.join(fixture, "src/app/data/buttons");
    const iri = "http://example.org/entity";
    const request = (button: string, value = iri) => GET(new Request(`http://localhost/api/query?${new URLSearchParams({ button, iri: value })}`));
    await t.test("missing and empty directory disable custom buttons", async () => {
      assert.deepEqual(await listQueryButtons(), []);
      await mkdir(directory, { recursive: true });
      assert.deepEqual(await listQueryButtons(), []);
    });
    await writeFile(path.join(directory, "related_papers.sparql"), 'SELECT ?x WHERE { <${iri}> ?p ?x . FILTER(?x != <${iri}>) }');
    await writeFile(path.join(directory, "describe.sparql"), 'DESCRIBE <${iri}>');
    await writeFile(path.join(directory, "exists.sparql"), 'ASK { <${iri}> ?p ?o }');
    await writeFile(path.join(directory, "graph.sparql"), 'CONSTRUCT { <${iri}> ?p ?o } WHERE { <${iri}> ?p ?o }');
    await writeFile(path.join(directory, "notes.txt"), "ignored");
    await mkdir(path.join(directory, "nested.sparql"));
    await symlink(path.join(directory, "describe.sparql"), path.join(directory, "link.sparql"));
    await t.test("labels, ordering, and file boundaries", async () => {
      assert.deepEqual(await listQueryButtons(), [
        { id: "describe", label: "Describe (custom)" },
        { id: "exists", label: "Exists" },
        { id: "graph", label: "Graph" },
        { id: "related_papers", label: "Related papers" },
      ]);
      assert.equal(await readButtonQuery("../describe"), null);
      assert.equal(await readButtonQuery("link"), null);
    });
    await t.test("read-only forms with comments and prefix/base declarations", () => {
      assert.equal(queryForm('# comment\nPREFIX ex: <http://example.org/#>\nBASE <http://example.org/>\nselect ?x {}'), "SELECT");
      assert.equal(queryForm('PREFIX : <urn:test:> # comment\nask {}'), "ASK");
      assert.throws(() => queryForm('PREFIX ex: <urn:test:> DELETE WHERE { ?s ?p ?o }'));
      assert.throws(() => queryForm('# SELECT\nINSERT DATA {}'));
      assert.throws(() => queryForm(''));
    });
    process.env.SPARQL_ENDPOINT = "http://endpoint.example/sparql";
    let calls = 0;
    let upstream: Response;
    let sentQuery = "";
    let accept = "";
    globalThis.fetch = async (input, init) => {
      calls++;
      sentQuery = new URL(String(input)).searchParams.get("query") ?? "";
      accept = new Headers(init?.headers).get("Accept") ?? "";
      return upstream;
    };
    await t.test("invalid requests never contact the endpoint", async () => {
      assert.equal((await request("related_papers", "bad iri")).status, 400);
      assert.equal((await request("related_papers", "http://example.org/> ?s ?p ?o")).status, 400);
      assert.equal((await request("")).status, 400);
      assert.equal((await request("../describe")).status, 404);
      assert.equal((await request("unknown")).status, 404);
      assert.equal(calls, 0);
    });
    await t.test("SELECT substitutes all placeholders and returns typed results", async () => {
      const data = { head: { vars: ["x"] }, results: { bindings: [{ x: { type: "literal", value: "hello" } }] } };
      upstream = Response.json(data);
      const response = await request("related_papers");
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { kind: "results", data });
      assert.equal(sentQuery, `SELECT ?x WHERE { <${iri}> ?p ?x . FILTER(?x != <${iri}>) }`);
      assert.equal(accept, "application/sparql-results+json");
    });
    await t.test("ASK preserves false results", async () => {
      const data = { head: {}, boolean: false };
      upstream = Response.json(data);
      assert.deepEqual(await (await request("exists")).json(), { kind: "results", data });
    });
    await t.test("DESCRIBE and CONSTRUCT parse RDF", async () => {
      for (const button of ["describe", "graph"]) {
        upstream = new Response(`<${iri}> <http://example.org/name> "Example" .`, { headers: { "Content-Type": "text/turtle" } });
        const response = await request(button);
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.kind, "rdf");
        assert.equal(payload.data.quads.length, 1);
        assert.equal(payload.data.quads[0].object.value, "Example");
        assert.match(accept, /text\/turtle/);
      }
    });
    await t.test("endpoint errors and unsupported templates produce errors", async () => {
      const originalError = console.error;
      console.error = () => {};
      try {
        upstream = new Response("failed", { status: 503 });
        assert.equal((await request("exists")).status, 500);
        upstream = Response.json({ unexpected: true });
        assert.equal((await request("exists")).status, 500);
        upstream = new Response("<html>error</html>", { headers: { "Content-Type": "text/html" } });
        assert.equal((await request("describe")).status, 500);
        await writeFile(path.join(directory, "update.sparql"), "DELETE WHERE { ?s ?p ?o }");
        const before = calls;
        assert.equal((await request("update")).status, 500);
        assert.equal(calls, before);
      } finally {
        console.error = originalError;
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEndpoint === undefined) delete process.env.SPARQL_ENDPOINT;
    else process.env.SPARQL_ENDPOINT = originalEndpoint;
    process.chdir(originalCwd);
    await rm(fixture, { recursive: true, force: true });
  }
});
