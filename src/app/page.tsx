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
      <section className="hero">
        <header className="hero-top">
          <div className="brand"><span className="logo" aria-hidden="true">K</span><span>KnowBridge</span></div>
          <nav className="hero-links" aria-label="Page sections">
            <a href="#ask">Ask</a>
            <a href="#workspace">Workspace</a>
            <a href="#brief">Decision brief</a>
            <a href="#sources">Sources</a>
          </nav>
        </header>
        <div className="hero-stage">
          <h1 className="hero-headline">
            <span className="line"><span data-line className="d-0">Evidence,</span></span>
            <span className="line"><span data-line className="d-1">attached.</span></span>
          </h1>
        </div>
        <div className="hero-left">
          <p className="hero-support" data-rise>
            Answers from your own documents, each carrying its quote, its source and its date.
          </p>
          <div className="hero-action d-1" data-rise>
            <a className="button" href="#ask">Ask the record</a>
          </div>
          <p className="pill d-3" data-rise>
            Grounded search available · fictional records · {sources.length} imported sources
          </p>
        </div>
        <div className="hero-fragment" data-ui>
          <p className="stamp"><b>Decision brief</b>Project Harbour · built from four authorized records</p>
          <p className="fragment-title">Hold the date until QA and security confirm</p>
          <p>The client target is not supported by the forecast on record.</p>
          <figure>
            <blockquote className="evidence-text">The latest forecast for final regression completion is 2026-11-11.</blockquote>
            <figcaption>
              <a href="/api/sources/HBR-DOC-04">Project Harbour QA Forecast (HBR-DOC-04)</a>
              <p>Source recorded date: 2026-10-10. Effective date: Not specified.</p>
            </figcaption>
          </figure>
        </div>
        <div className="hero-accent d-2" data-rise>
          <p className="figure">10</p>
          <p className="figure-note">days the QA forecast runs past the client target in the record (HBR-DOC-02, HBR-DOC-04).</p>
        </div>
      </section>

      <section className="field field--lime" id="proof">
        <h2 className="proof-head" data-reveal>
          <span>What the</span>
          <span className="step-2">record shows</span>
        </h2>
        <table className="proof-table">
          <thead>
            <tr>
              <th className="col-id" scope="col">Record</th>
              <th className="col-fact" scope="col">What it says</th>
              <th className="col-date" scope="col">Date</th>
              <th className="col-status" scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr data-reveal className="d-0">
              <th className="col-id" scope="row">HBR-DOC-02</th>
              <td className="col-fact">Client target delivery</td>
              <td className="col-date">2026-11-01</td>
              <td className="col-status">Baseline</td>
            </tr>
            <tr data-reveal className="d-1">
              <th className="col-id" scope="row">HBR-DOC-04</th>
              <td className="col-fact">QA completion forecast</td>
              <td className="col-date">2026-11-11</td>
              <td className="col-status">Forecast</td>
            </tr>
            <tr data-reveal className="d-2">
              <th className="col-id" scope="row">HBR-DOC-06</th>
              <td className="col-fact">Production security approval</td>
              <td className="col-date">Not dated</td>
              <td className="col-status">Pending</td>
            </tr>
            <tr data-reveal className="d-3">
              <th className="col-id" scope="row">HBR-DOC-09</th>
              <td className="col-fact">Revised delivery commitment</td>
              <td className="col-date">Not issued</td>
              <td className="col-status">None authorized</td>
            </tr>
          </tbody>
        </table>
        <p className="proof-note d-4" data-reveal>
          No pilot is approved. Nothing here is production approval; a human verifies every high-impact recommendation.
        </p>
      </section>

      <section className="field field--white" id="ask">
        <div className="axis">
          <div className="stamp" data-reveal>
            <p><b>HBR-DOC-02</b>Client target · 2026-11-01</p>
            <p><b>Try the record</b>“Can Project Harbour launch on 1 Nov?”<br />“What is the personal mobile number of the CEO?”</p>
          </div>
          <div className="section-copy d-1" data-reveal>
            <p>Every answer arrives with its evidence.</p>
            <p className="section-intro">A question gets an answer only where the evidence supports one. Each claim carries its excerpt, its source and its date.</p>
          </div>
        </div>
        <AskPanel />
      </section>

      <section className="field field--tone" id="workspace">
        <div className="axis">
          <p className="stamp" data-reveal><b>Drive updated is not recorded</b>Both dates stay visible; neither is rewritten.</p>
          <div className="section-copy d-1" data-reveal>
            <p>Import is explicit, bounded and reversible.</p>
            <p className="section-intro">Select files, confirm the import, and disconnect to delete every copy and revoke the token. Imported evidence never reaches public search.</p>
          </div>
        </div>
        <WorkspacePanel {...workspace} nonce={nonce} />
      </section>

      <section className="field field--white" id="brief">
        <div className="axis">
          <p className="stamp" data-reveal><b>HBR-DOC-06</b>Production security approval · Pending</p>
          <div className="section-copy d-1" data-reveal>
            <p>A recommendation, never an approval.</p>
            <p className="section-intro">The brief separates what is recorded from what is forecast, and says so plainly when the evidence is missing.</p>
          </div>
        </div>
        <DecisionBriefPanel />
      </section>

      <section className="field field--tone" id="sources">
        <div className="axis">
          <p className="stamp" data-reveal><b>HBR-DOC-09</b>No revised delivery commitment authorized.</p>
          <div className="section-copy d-1" data-reveal>
            <p>The corpus is invented. The semantics are not.</p>
            <p className="section-intro">Every record carries its recorded date beside its effective date, and its original text stays open to inspection.</p>
          </div>
        </div>
        {unavailable ? <p role="alert">Source catalog unavailable. Please try again later.</p> : <SourceExplorer sources={sources} />}
      </section>

      <section className="field field--soot">
        <h2 className="closing-head" data-reveal>
          <span className="line">Fictional records.</span>
          <span className="line">Real semantics.</span>
        </h2>
        <p className="closing-copy d-1" data-reveal>
          Every organisation, person and record on this page is synthetic. The dates, statuses and refusals follow the real product rules.
        </p>
        <div className="closing-action d-2" data-reveal>
          <a className="button" href="#ask">Ask the record</a>
        </div>
      </section>
      <div className="world-band">
        <img src="/media/sme-florist-studio.jpg" width={1920} height={1280} alt="A small floral studio owner arranging dried flowers beside her worktable" loading="lazy" decoding="async" data-reveal className="d-0" />
        <img src="/media/sme-shop-counter.jpg" width={1920} height={1280} alt="A shop owner working at the point-of-sale screen behind her counter" loading="lazy" decoding="async" data-reveal className="d-1" />
        <img src="/media/sme-shop-front.jpg" width={1920} height={1280} alt="A café owner holding a welcome sign at the door of her shop" loading="lazy" decoding="async" data-reveal className="d-2" />
        <p className="tile d-3" data-reveal>Every claim comes from a document.</p>
      </div>
      <footer>
        <p>KnowBridge · All sample organizations, people, and records are fictional.</p>
        <p>AI Builder Cup 2026 · Synthetic demo company</p>
      </footer>
    </main>
  );
}
