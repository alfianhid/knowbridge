'use client';

import React, { useRef, useState } from 'react';
import { SourceDetailSchema, type SourceDetail } from '../lib/source-detail';
import { z } from 'zod';
import { SAMPLE_QUESTIONS, SampleQuestions } from './sample-questions';
import { useJudgeSession } from './judge-session';

// Client-side parse mirrors the server contract. Anything unexpected fails closed to an error message.
const EvidenceSchema = z.object({
  sourceId: z.string(), excerpt: z.string(), sourceTitle: z.string(),
  sourceUrl: z.string().regex(/^\/api\/sources\/[A-Za-z0-9_-]+$/),
  recordedAt: z.string(), effectiveAt: z.string().nullable(),
});
const BriefSchema = z.object({
  id: z.string(), question: z.string(), createdAt: z.string(), model: z.string(),
  status: z.enum(['supported', 'at_risk', 'insufficient_evidence']),
  reviewedByHuman: z.boolean(), reviewedAt: z.string().nullable(), synthetic: z.literal(true),
  brief: z.object({
    recommendation: z.string(),
    supportingClaims: z.array(z.object({ claim: z.string(), evidence: z.array(EvidenceSchema) })),
    conflicts: z.array(z.object({ description: z.string(), type: z.string(), left: EvidenceSchema, right: EvidenceSchema, resolution: z.string().optional() })),
    alternatives: z.array(z.object({ option: z.string(), tradeoff: z.string() })),
    unknowns: z.array(z.string()),
    suggestedNextStep: z.string(),
  }),
});
type SavedBrief = z.infer<typeof BriefSchema>;

const STATUS_LABEL: Record<SavedBrief['status'], string> = {
  supported: 'Evidence-backed',
  at_risk: 'At risk, needs human decision',
  insufficient_evidence: 'Insufficient evidence',
};

export function DecisionBriefPanel() {
  const session = useJudgeSession();
  return <DecisionBriefContent key={session?.uid ?? 'operator'} />;
}

function DecisionBriefContent() {
  const session = useJudgeSession();
  const signedIn = Boolean(session?.uid);
  const [token, setToken] = useState('');
  const [items, setItems] = useState<SavedBrief[]>([]);
  const [listPending, setListPending] = useState(false);
  const [reviewPending, setReviewPending] = useState(false);
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [sourcePending, setSourcePending] = useState(false);
  const sourceVersion = useRef(0);
  const briefOperation = useRef(false);
  const retry = useRef<{ question: string; key: string } | null>(null);
  async function authorizationHeaders() {
    return { Authorization: `Bearer ${session?.configured ? await session.getToken() : token.trim()}` };
  }
  const [question, setQuestion] = useState<string>(SAMPLE_QUESTIONS[0].question);
  const [pending, setPending] = useState(false);
  const [brief, setBrief] = useState<SavedBrief | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = pending || listPending || reviewPending;

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (briefOperation.current) return;
    if (question.trim().length < 4) {
      setError('Enter a question with at least 4 characters.');
      return;
    }
    if (!signedIn && !token.trim()) { setError(session?.configured ? 'Sign in with your judge account first.' : 'Enter a member Firebase ID token.'); return; }
    const trimmed = question.trim();
    if (!retry.current || retry.current.question !== trimmed) retry.current = { question: trimmed, key: crypto.randomUUID() };
    briefOperation.current = true;
    sourceVersion.current += 1; setSource(null); setSourcePending(false);
    setPending(true);
    setBrief(null);
    setError(null);
    try {
      // Retain the key after failure so a retry cannot create a duplicate saved brief.
      const response = await fetch('/api/decision-briefs', {
        method: 'POST',
        headers: { ...await authorizationHeaders(), 'Content-Type': 'application/json', 'Idempotency-Key': retry.current.key },
        body: JSON.stringify({ question: question.trim() }),
      });
      if (!response.ok) throw new Error('Brief unavailable');
      const parsed = BriefSchema.parse(await response.json());
      setBrief(parsed);
      setItems(current => [parsed, ...current.filter(item => item.id !== parsed.id)]);
      retry.current = null;
    } catch {
      setError('Decision brief unavailable. Check the question and try again.');
    } finally {
      briefOperation.current = false;
      setPending(false);
    }
  }

  async function review() {
    if (!brief || brief.reviewedByHuman || briefOperation.current) return;
    briefOperation.current = true;
    setReviewPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/decision-briefs/${encodeURIComponent(brief.id)}/review`, { method: 'POST', headers: await authorizationHeaders() });
      if (!response.ok) throw new Error('Review unavailable');
      setBrief(BriefSchema.parse(await response.json()));
    } catch {
      setError('Review could not be recorded. Please try again.');
    } finally { briefOperation.current = false; setReviewPending(false); }
  }

  async function refresh() {
    if (briefOperation.current || (!signedIn && !token.trim())) return;
    briefOperation.current = true;
    setListPending(true); setError(null);
    try {
      const response = await fetch('/api/decision-briefs', { headers: await authorizationHeaders(), cache: 'no-store' });
      if (!response.ok) throw new Error('Unavailable');
      setItems(z.object({ items: z.array(BriefSchema) }).parse(await response.json()).items);
    } catch { setError('Saved briefs unavailable. Please retry.'); }
    finally { briefOperation.current = false; setListPending(false); }
  }

  async function reopen(id: string) {
    if (briefOperation.current || (!signedIn && !token.trim())) return;
    briefOperation.current = true;
    sourceVersion.current += 1; setSourcePending(false);
    setPending(true); setError(null); setBrief(null); setSource(null);
    try {
      const response = await fetch(`/api/decision-briefs/${encodeURIComponent(id)}`, { headers: await authorizationHeaders(), cache: 'no-store' });
      if (!response.ok) throw new Error('Unavailable');
      const parsed = BriefSchema.parse(await response.json());
      if (parsed.id !== id) throw new Error('Brief mismatch');
      setBrief(parsed);
    } catch { setError('Saved brief unavailable. Please retry.'); }
    finally { briefOperation.current = false; setPending(false); }
  }

  async function openSource(evidence: z.infer<typeof EvidenceSchema>) {
    const version = ++sourceVersion.current;
    setSource(null); setSourcePending(true); setError(null);
    try {
      const response = await fetch(evidence.sourceUrl, { headers: await authorizationHeaders(), cache: 'no-store' });
      if (!response.ok) throw new Error('Unavailable');
      const parsed = SourceDetailSchema.parse(await response.json());
      if (parsed.id !== evidence.sourceId) throw new Error('Source mismatch');
      if (sourceVersion.current === version) setSource(parsed);
    } catch { if (sourceVersion.current === version) setError('Source unavailable. Select the evidence to retry.'); }
    finally { if (sourceVersion.current === version) setSourcePending(false); }
  }

  function evidenceView(evidence: z.infer<typeof EvidenceSchema>, key: string) {
    return <figure key={key}>
      <blockquote className="evidence-text">{evidence.excerpt}</blockquote>
      <figcaption>
        <button type="button" onClick={() => openSource(evidence)} aria-controls="brief-source-details">
          {evidence.sourceTitle} ({evidence.sourceId})
        </button>
        <p>Source recorded date: {evidence.recordedAt}. Effective date: {evidence.effectiveAt ?? 'Not specified'}.</p>
      </figcaption>
    </figure>;
  }

  return (
    <section className="ask-panel decision-brief" aria-labelledby="brief-title">
      <h2 id="brief-title">Decision brief</h2>
      <p className="disclosure">
        Fictional synthetic records only. A generated brief is a conditional recommendation for a human decision-maker, not an approval.
      </p>
      {!session?.configured ? <><label htmlFor="brief-token">Member Firebase ID token</label>{' '}
      <input id="brief-token" type="password" value={token} autoComplete="off" spellCheck={false}
        disabled={pending || reviewPending || listPending || sourcePending}
        onChange={event => {
          setToken(event.target.value); setBrief(null); setItems([]); setSource(null); setError(null);
          retry.current = null; sourceVersion.current += 1;
        }} />
      <p className="disclosure">Operator session: use an authorized member token. Held in memory only; cleared on reload.</p></> : <p>{signedIn ? 'Judge account signed in. Session renews automatically.' : 'Sign in above to create and reopen decision briefs.'}</p>}
      <button type="button" onClick={refresh} disabled={(!signedIn && !token.trim()) || listPending || pending || reviewPending}>
        {listPending ? 'Loading saved briefs...' : 'Refresh saved briefs'}
      </button>
      <ul aria-label="Saved decision briefs">{items.map(item => <li key={item.id}>
        <button type="button" disabled={busy} onClick={() => reopen(item.id)}>{item.question}</button>
      </li>)}</ul>
      <SampleQuestions label="Decision brief sample questions" disabled={busy} onSelect={value => {
        if (value.trim() !== question.trim()) retry.current = null;
        setQuestion(value);
      }} />
      <p className="disclosure">Judge walkthrough: sign in with your judge account, create a brief, inspect its evidence, mark it reviewed, then refresh and reopen it. Review is not business approval.</p>
      <form onSubmit={create}>
        <label htmlFor="brief-question">Decision question</label>{' '}
        <textarea id="brief-question" rows={3} value={question} minLength={4} maxLength={2000} required disabled={busy}
          onChange={event => {
            if (event.target.value.trim() !== question.trim()) retry.current = null;
            setQuestion(event.target.value);
          }} />{' '}
        <button type="submit" disabled={busy || !question.trim()}>Create brief</button>
      </form>
      <p role="status" aria-live="polite">{pending ? 'Building brief from authorized evidence…' : brief ? 'Brief ready.' : ''}</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="brief-workspace">
      {brief ? (
        <article aria-label="Generated decision brief">
          <p className="disclosure">Model {brief.model} · created {brief.createdAt}</p>
          <h3>{STATUS_LABEL[brief.status]}</h3>
          <p>{brief.brief.recommendation}</p>
          {brief.brief.supportingClaims.map((claim, index) => (
            <section key={index} aria-label={`Brief claim ${index + 1}`}>
              <h4>{claim.claim}</h4>
              {claim.evidence.map((evidence, evidenceIndex) => (
                evidenceView(evidence, `${evidence.sourceId}:${evidenceIndex}`)
              ))}
            </section>
          ))}
          {brief.brief.conflicts.length > 0 ? (
            <>
              <h4>Conflicts and timeline findings</h4>
              <ul>{brief.brief.conflicts.map((conflict, index) => <li key={index}>{conflict.description}{conflict.resolution ? ` ${conflict.resolution}` : ''}
                {evidenceView(conflict.left, 'left')}{evidenceView(conflict.right, 'right')}</li>)}</ul>
            </>
          ) : null}
          {brief.brief.alternatives.length > 0 ? (
            <>
              <h4>Alternatives</h4>
              <ul>{brief.brief.alternatives.map((item, index) => <li key={index}><strong>{item.option}:</strong> {item.tradeoff}</li>)}</ul>
            </>
          ) : null}
          {brief.brief.unknowns.length > 0 ? (
            <>
              <h4>Unknowns</h4>
              <ul>{brief.brief.unknowns.map((unknown, index) => <li key={index}>{unknown}</li>)}</ul>
            </>
          ) : null}
          <h4>Suggested next step</h4>
          <p>{brief.brief.suggestedNextStep}</p>
          <p role="status">
            {brief.reviewedByHuman ? `Reviewed by a human on ${brief.reviewedAt}. This is not production approval.` : 'Not yet reviewed by a human.'}
          </p>
          {!brief.reviewedByHuman ? (
            <button type="button" onClick={review} disabled={busy}>{reviewPending ? 'Recording review...' : 'Mark evidence reviewed'}</button>
          ) : null}
        </article>
      ) : null}
      {sourcePending || source ? <aside className="source-detail" id="brief-source-details" aria-label="Brief source details" aria-busy={sourcePending}>
        {sourcePending ? <p role="status">Loading source details...</p> : null}
        {source ? <><h3>{source.title}</h3><p>{source.id} · {source.owner}</p>
          <p>Source recorded date: {source.recordedAt}. Effective date: {source.effectiveAt ?? 'Not specified'}.</p>
          <p className="date-note">This historical source date is not a Google Drive updated timestamp.</p>
          <pre tabIndex={0} role="region" aria-label="Original source text">{source.content}</pre></> : null}
      </aside> : null}
      </div>
    </section>
  );
}
