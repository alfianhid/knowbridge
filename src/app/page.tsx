import { SourceExplorer } from '@/components/source-explorer';
import { AskPanel } from '@/components/ask-panel';
import { DecisionBriefPanel } from '@/components/decision-brief-panel';
import { DEMO_TENANT_ID, listSourceSummariesForTenant } from '@/lib/sources';
import { limitPublicReads } from '@/lib/api-limits';
import { WorkspacePanel } from '@/components/workspace-panel';
import { workspacePublicConfig } from '@/lib/workspace-config';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const workspace = workspacePublicConfig();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  let sources: Awaited<ReturnType<typeof listSourceSummariesForTenant>> = [];
  let unavailable = false;
  try { limitPublicReads(); sources = await listSourceSummariesForTenant(DEMO_TENANT_ID); } catch { unavailable = true; }

  return (
    <main className="shell">
      <header className="nav">
        <div className="brand"><span className="logo" aria-hidden="true">K</span><span>KnowBridge</span></div>
        <span className="micro">AI Builder Cup 2026 · Synthetic demo company</span>
      </header>
      <section className="hero compact">
        <p className="eyebrow">SINGAPORE-FIRST · GOOGLE WORKSPACE · EVIDENCE CATALOG</p>
        <h1>Know what your sources <em>actually say.</em></h1>
        <p className="intro">Inspect the evidence behind Project Harbour. Source dates and original text stay attached to every fictional record.</p>
        <div className="pill">Grounded search available · fictional records · {sources.length} imported sources</div>
      </section>
      <AskPanel />
      <WorkspacePanel {...workspace} nonce={nonce} />
      <DecisionBriefPanel />
      {unavailable ? <p role="alert">Source catalog unavailable. Please try again later.</p> : <SourceExplorer sources={sources} />}
      <footer>KnowBridge · All sample organizations, people, and records are fictional.</footer>
    </main>
  );
}
