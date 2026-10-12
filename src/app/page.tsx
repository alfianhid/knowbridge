import { SourceExplorer } from '@/components/source-explorer';
import { DEMO_TENANT_ID, listSourceSummariesForTenant } from '@/lib/sources';

export default async function Home() {
  const sources = await listSourceSummariesForTenant(DEMO_TENANT_ID);

  return (
    <main className="shell">
      <header className="nav">
        <div className="brand"><span className="logo">K</span><span>KnowBridge</span></div>
        <span className="micro">AI Builder Cup 2026 · Synthetic demo</span>
      </header>
      <section className="hero compact">
        <p className="eyebrow">SINGAPORE-FIRST · GOOGLE WORKSPACE · EVIDENCE CATALOG</p>
        <h1>Know what your sources <em>actually say.</em></h1>
        <p className="intro">Inspect a bounded local import before retrieval or AI synthesis. Stable IDs and source dates stay attached to every fictional record.</p>
        <div className="pill">Local source catalog ready · AI remains disabled</div>
      </section>
      <SourceExplorer sources={sources} />
      <footer>KnowBridge · All sample organizations, people, and records are fictional.</footer>
    </main>
  );
}
