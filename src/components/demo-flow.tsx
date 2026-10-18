'use client';

import { useEffect, useState } from 'react';

type FlowStep = { id: string; num: string; nav: string; title: string; note: string };

export const FLOW_STEPS: readonly FlowStep[] = [
  {
    id: 'ask', num: '1', nav: 'Ask', title: 'Ask the record',
    note: 'Ask the prefilled Harbour question first. Every answer arrives with its excerpt, its source and its date, and the absent-evidence question should abstain.',
  },
  {
    id: 'judge-signin', num: '2', nav: 'Judge sign-in', title: 'Judge access',
    note: 'Use the judge account supplied by the demo operator. Briefs and workspace stay locked until sign-in completes.',
  },
  {
    id: 'brief', num: '3', nav: 'Decision brief', title: 'Decision brief',
    note: 'Create a brief from the evidence, inspect every excerpt, then mark it reviewed. Review is not an approval.',
  },
  {
    id: 'workspace', num: '4', nav: 'Workspace', title: 'Workspace import',
    note: 'Connect the fictional demo account, import the registered Harbour files, then disconnect to delete every copy. Imported evidence never reaches public search.',
  },
  {
    id: 'sources', num: '5', nav: 'Sources', title: 'Sources',
    note: 'Open any record: its recorded date sits beside its effective date, and the original text stays open to inspection.',
  },
];

const FLOW_IDS = FLOW_STEPS.map((step) => step.id);

function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).id;
        if (entry.isIntersecting) visible.add(id);
        else visible.delete(id);
      }
      setActive(FLOW_IDS.find((id) => visible.has(id)) ?? null);
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    for (const id of FLOW_IDS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

export function SectionNav() {
  const active = useActiveSection();
  return (
    <nav className="hero-links" aria-label="Page sections">
      {FLOW_STEPS.map((step) => (
        <a key={step.id} href={`#${step.id}`} aria-current={active === step.id ? 'location' : undefined}>
          <span className="flow-num" aria-hidden="true">{step.num}</span>{step.nav}
        </a>
      ))}
    </nav>
  );
}

export function DemoFlow() {
  const active = useActiveSection();
  return (
    <section className="field field--tone" aria-labelledby="flow-guide-title">
      <header className="section-head" data-reveal>
        <div className="section-copy">
          <h2 id="flow-guide-title">How this demo runs.</h2>
          <p className="section-intro">Five steps, in order: question in, evidence attached, recommendation out, never an approval. Sign in first at step 2; briefs and workspace open only for a signed-in judge.</p>
        </div>
        <div className="section-meta flow-guide-meta">
          <p className="meta-item"><b>Fictional records, real rules</b>Every organisation, person and record is synthetic; the dates, statuses and refusals follow the real product rules.</p>
        </div>
      </header>
      <ol className="flow-list">
        {FLOW_STEPS.map((step) => (
          <li key={step.id} className={active === step.id ? 'flow-row is-active' : 'flow-row'}>
            <a className="flow-row-link" href={`#${step.id}`} aria-current={active === step.id ? 'step' : undefined}>
              <span className="flow-num" aria-hidden="true">{step.num}</span>
              <span className="flow-row-body">
                <b className="flow-row-title">{step.title}</b>
                <span className="flow-row-note">{step.note}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
