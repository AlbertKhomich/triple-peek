import Search from "./search";
import GraphBackground from "@/components/GraphBackground";
import SiteHeader from "@/components/SiteHeader";
import DiceFooter from "@/components/DiceFooter";
import { listQueryButtons } from "../../lib/query-buttons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const buttons = await listQueryButtons();
  return (
    <>
      <GraphBackground />
      <div className="app-content">
        <main className="papers-page">
          <SiteHeader />
          <section className="paper-search" aria-labelledby="page-title">
            <Search buttons={buttons} />
          </section>
          <DiceFooter />
        </main>
      </div>
    </>
  );
}
