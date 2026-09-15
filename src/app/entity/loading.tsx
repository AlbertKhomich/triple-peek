import Link from "next/link";

export default function Loading() {
  return (
    <main className="entity-page">
      <div className="entity-content">
        <Link className="entity-back" href="/">← Back to search</Link>
        <header className="entity-header"><h1>Entity description</h1></header>
        <p className="entity-message" role="status">Loading description…</p>
      </div>
    </main>
  );
}
