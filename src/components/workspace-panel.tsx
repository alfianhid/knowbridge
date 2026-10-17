'use client';

import React, { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { selectWorkspaceFiles } from '../lib/workspace-picker';
import { SAMPLE_QUESTIONS, SampleQuestions } from './sample-questions';
import { useJudgeSession } from './judge-session';

const Job = z.object({ status: z.enum(['queued', 'exporting', 'indexing', 'completed', 'partially_failed', 'cancelled', 'expired']), total: z.number(), completed: z.number(), failed: z.number(), searchable: z.number(), retryAt: z.number().optional() });
const Status = z.object({ connected: z.boolean(), expiresAt: z.number().optional(), sources: z.array(z.object({ id: z.string(), title: z.string(), modifiedTime: z.string(), importedAt: z.string(), recordedAt: z.string(), effectiveAt: z.string().nullable(), chunkCount: z.number() })), job: Job.optional(), cleanup: z.string().optional() });
const Answer = z.object({ answer: z.string(), status: z.enum(['supported', 'insufficient_evidence']), mode: z.enum(['local', 'vertex']), model: z.string().nullable(), claims: z.array(z.object({ claim: z.string(), evidence: z.array(z.object({ sourceId: z.string(), sourceTitle: z.string(), excerpt: z.string() })) })), unknowns: z.array(z.string()) });
const Source = z.object({ title: z.string(), content: z.string(), rawExport: z.string().optional(), recordedAt: z.string(), effectiveAt: z.string().nullable(), modifiedTime: z.string().optional(), importedAt: z.string().optional() });
const active = (job: z.infer<typeof Job> | undefined) => job && ['queued', 'exporting', 'indexing'].includes(job.status);

interface WorkspacePanelProps { enabled: boolean; configured: boolean; nonce?: string }

export function WorkspacePanel(props: WorkspacePanelProps) {
  const session = useJudgeSession();
  return <WorkspaceContent key={session?.uid ?? 'operator'} {...props} />;
}

function WorkspaceContent({ enabled, configured, nonce }: WorkspacePanelProps) {
  const session = useJudgeSession();
  const signedIn = Boolean(session?.uid);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<z.infer<typeof Status> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [answer, setAnswer] = useState<z.infer<typeof Answer> | null>(null);
  const [source, setSource] = useState<z.infer<typeof Source> | null>(null);
  const [question, setQuestion] = useState<string>(SAMPLE_QUESTIONS[0].question);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const pickerAbort = useRef<AbortController | null>(null);
  const popup = useRef<Window | null>(null);
  const operation = useRef(false);
  useEffect(() => () => { version.current++; pickerAbort.current?.abort(); popup.current?.close(); }, []);
  useEffect(() => {
    if (!status?.expiresAt) return;
    const timer = setTimeout(() => {
      version.current++; pickerAbort.current?.abort(); setAnswer(null); setSource(null); setSelected([]);
      setStatus(null); setBusy(false); operation.current = false;
      setNotice('Google connection expired. Reconnect before using imported evidence.');
    }, Math.max(0, status.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [status?.expiresAt]);
  function clear() { version.current++; pickerAbort.current?.abort(); popup.current?.close(); setStatus(null); setSelected([]); setAnswer(null); setSource(null); setNotice(''); setError(''); setBusy(false); operation.current = false; }
  async function request(path: string, body?: unknown) {
    const response = await fetch(`/api/workspace/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${session?.configured ? await session.getToken() : token.trim()}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store' });
    if (!response.ok) throw new Error('Workspace request failed');
    return response.json() as Promise<unknown>;
  }
  async function run(work: (current: () => boolean) => Promise<void>) {
    if (operation.current || (!signedIn && !token.trim())) { if (!signedIn && !token.trim()) setError('Sign in with your judge account first.'); return; }
    const epoch = version.current; operation.current = true; setBusy(true); setError('');
    const current = () => epoch === version.current;
    try { await work(current); } catch { if (current()) { setAnswer(null); setSource(null); setError('Workspace unavailable. Check access, refresh status, then retry.'); } }
    finally { if (current()) { operation.current = false; setBusy(false); } }
  }
  async function refresh(current: () => boolean) { const next = Status.parse(await request('status')); if (current()) { setStatus(next); if (!next.connected) { setAnswer(null); setSource(null); setSelected([]); } } return next; }
  async function advance(current: () => boolean) {
    let next = await refresh(current);
    // Each request advances one bounded server step. A retry deadline requires an explicit refresh.
    for (let step = 0; current() && active(next.job) && step < 40; step++) {
      if (next.job?.retryAt && next.job.retryAt > Date.now()) { setNotice('Import paused for quota. Refresh after the retry time.'); break; }
      await request('import/step', {}); if (!current()) return; next = await refresh(current);
    }
  }
  function connect() {
    if (operation.current || (!signedIn && !token.trim())) { setError('Sign in with your judge account first.'); return; }
    popup.current = window.open('about:blank', '_blank', 'popup,width=600,height=720');
    if (!popup.current) { setError('Allow the Google consent popup, then retry.'); return; }
    void run(async current => {
      try {
        const result = z.object({ url: z.url() }).parse(await request('oauth/start', {}));
        const url = new URL(result.url);
        if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') throw new Error('Invalid consent URL');
        if (current() && popup.current) { popup.current.location.href = url.href; setNotice('Finish Google consent, then refresh status.'); }
      } catch (error) { popup.current?.close(); throw error; }
    });
  }
  const available = enabled && configured;
  return <section className="ask-panel workspace-panel" aria-label="Google Workspace">
    <h2>Google Workspace selected files</h2>
    {!available && <p>Synthetic seed corpus remains active. Workspace import is {enabled ? 'not configured' : 'disabled'}. Existing connections can still be disconnected below.</p>}
    <p className="disclosure">Fictional demo only. Import registered fictional files only. Gemini uses the global endpoint; embeddings use US processing. This is not Singapore-only processing. Sheets import the first tab only.</p>
    <p>Workspace evidence stays in this panel. Public search and decision briefs use the synthetic seed corpus.</p>
    <p className="disclosure">Judge walkthrough: sign in with your judge account, connect a demo Google account, select registered fictional files, confirm import, then search. Harbour samples need Harbour files; missing evidence may return insufficient evidence.</p>
    {!session?.configured ? <><label>Workspace member Firebase ID token<input type="password" autoComplete="off" value={token} onChange={event => { clear(); setToken(event.target.value); }} /></label>
    <p>Token stays in this page’s memory. Changing member clears displayed private evidence.</p></> : <p>{signedIn ? 'Judge account signed in. Session renews automatically.' : 'Sign in above before connecting Google Workspace.'}</p>}
    {available && <button disabled={busy} onClick={connect}>Connect Google Workspace</button>}
    <button disabled={busy} onClick={() => void run(advance)}>Refresh Workspace status</button>
    <button disabled={busy} onClick={() => { setAnswer(null); setSource(null); setSelected([]); setStatus(null); pickerAbort.current?.abort(); popup.current?.close(); void run(async current => { const result = z.object({ revocation: z.enum(['confirmed', 'unconfirmed']), cleanup: z.enum(['completed', 'incomplete']) }).parse(await request('disconnect', {})); if (current()) { setStatus(null); setNotice(`Disconnected. Token revocation ${result.revocation}; copy cleanup ${result.cleanup}.`); } }); }}>Disconnect and delete imported copies</button>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {available && status && <><p>{status.connected ? 'Google connection verified.' : 'Google connection unavailable.'}</p>
      <button disabled={busy || !status.connected} onClick={() => void run(async current => { const config = z.object({ accessToken: z.string(), developerKey: z.string(), appId: z.string(), expiresAt: z.number() }).parse(await request('picker', {})); if (!current()) return; pickerAbort.current = new AbortController(); const ids = await selectWorkspaceFiles(config, nonce, pickerAbort.current.signal); if (current()) setSelected(ids); })}>Select fictional Docs or Sheets</button>
      {selected.length > 0 && <div><p>{selected.length} selected files. Limits: 3 files, 64 KiB per file, 192 KiB total, 32 chunks and 64 embedding attempts maximum.</p><button disabled={busy} onClick={() => void run(async current => { await request('import', { fileIds: selected }); if (current()) { setSelected([]); await advance(current); } })}>Confirm import selected fictional files</button></div>}
      {status.job && <div role="status"><p>Import {status.job.status}: {status.job.completed}/{status.job.total} processed; {status.job.failed} failed; {status.job.searchable} searchable.</p>{status.job.retryAt && <p>Retry after {new Date(status.job.retryAt).toISOString()}.</p>}{active(status.job) && <button onClick={() => { version.current++; operation.current = false; setBusy(false); void run(async current => { await request('import/cancel', {}); await refresh(current); }); }}>Cancel import</button>}</div>}
      <ul>{status.sources.map(item => <li key={item.id}>{item.title} — {item.chunkCount} chunks. Drive updated {item.modifiedTime}; imported {item.importedAt}; recorded {item.recordedAt}; effective {item.effectiveAt ?? 'not specified'}.</li>)}</ul>
      <SampleQuestions label="Workspace sample questions" onSelect={setQuestion} disabled={busy} />
      <form onSubmit={event => { event.preventDefault(); void run(async current => { setAnswer(null); setSource(null); const result = Answer.parse(await request('ask', { question: question.trim() })); if (current()) setAnswer(result); }); }}><label>Workspace question<input value={question} onChange={event => setQuestion(event.target.value)} minLength={4} maxLength={2000} required /></label><button disabled={busy || !status.connected || status.sources.length === 0}>Search Workspace selected files</button></form>
    </>}
    {answer && <article aria-label="Workspace answer"><h3>{answer.status === 'insufficient_evidence' ? 'Insufficient evidence' : 'Grounded Workspace answer'}</h3><p>{answer.mode === 'local' ? 'Local deterministic evidence lookup; no AI synthesis.' : `Vertex AI synthesis · ${answer.model}`}</p><p>{answer.answer}</p>{answer.claims.map((claim, index) => <div key={index}><p>{claim.claim}</p>{claim.evidence.map((evidence, evidenceIndex) => <div key={evidenceIndex}><blockquote>{evidence.excerpt}</blockquote><button disabled={busy} onClick={() => void run(async current => { setSource(null); const result = Source.parse(await request(`sources/${encodeURIComponent(evidence.sourceId)}`)); if (current()) setSource(result); })}>Inspect {evidence.sourceTitle}</button></div>)}</div>)}<ul>{answer.unknowns.map((unknown, index) => <li key={index}>{unknown}</li>)}</ul><p>Human verification required before high-impact decisions.</p></article>}
    {source && <article className="source-detail" aria-label="Workspace source"><h3>{source.title}</h3><p>Recorded {source.recordedAt}; effective {source.effectiveAt ?? 'not specified'}; Drive updated {source.modifiedTime ?? 'not supplied'}; imported {source.importedAt ?? 'not supplied'}.</p><h4>Evidence text</h4><p>Sheets evidence labels literal cells with their column and row. Raw export is shown separately.</p><pre tabIndex={0}>{source.content}</pre>{source.rawExport && <><h4>Literal Drive export</h4><pre tabIndex={0}>{source.rawExport}</pre></>}<button onClick={() => setSource(null)}>Close Workspace source</button></article>}
  </section>;
}
