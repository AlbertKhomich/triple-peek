import Search from "./search";
import GraphBackground from "@/components/GraphBackground";
import SiteHeader from "@/components/SiteHeader";
import DiceFooter from "@/components/DiceFooter";
import { hasExpandQuery } from "../../lib/expand-query";

export const dynamic = "force-dynamic";

export default async function Home() {
  const detailsEnabled = await hasExpandQuery();
  return (
    <>
      <GraphBackground />
      <div className="app-content">
        <main className="papers-page">
          <SiteHeader />
          <section className="paper-search" aria-labelledby="page-title">
            <h1 id="page-title">Triple Peek</h1>
            <Search detailsEnabled={detailsEnabled} />
          </section>
          <DiceFooter />
        </main>
      </div>
    </>
  );
}
