// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DecisionBriefPanel } from '../src/components/decision-brief-panel';

const evidence = {
  sourceId: 'HBR-DOC-04', excerpt: 'The latest forecast for final regression completion is 2026-11-11.',
  sourceTitle: 'Project Harbour — QA Forecast', sourceUrl: '/api/sources/HBR-DOC-04',
  recordedAt: '2026-10-10', effectiveAt: null,
};
const saved = {
  id: '00000000-0000-4000-8000-000000000001', question: 'Can we commit to launching Project Harbour on 2026-11-01?',
  createdAt: '2026-10-16T01:00:00.000Z', model: 'gemini-3.8-flash', status: 'at_risk',
  reviewedByHuman: false, reviewedAt: null, synthetic: true,
  brief: {
    recommendation: 'Seek customer, QA and security evidence before any commitment to 2026-11-01.',
    supportingClaims: [{ claim: 'The latest QA forecast is 2026-11-11.', evidence: [evidence] }],
    conflicts: [], alternatives: [{ option: 'Postpone full release', tradeoff: 'Requires customer agreement.' }],
    unknowns: ['Customer approval for a revised date is not recorded.'],
    suggestedNextStep: 'Escalate to owners for a human decision.',
  },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function fill(text: string) {
  fireEvent.change(screen.getByLabelText('Member Firebase ID token'), { target: { value: 'member-token' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Decision question' }), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Create brief' }));
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('decision brief panel', () => {
  it('refuses a too-short question without calling the API', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />);
    fill(' ab ');
    expect(screen.getByRole('alert').textContent).toBe('Enter a question with at least 4 characters.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('creates a brief with a per-request idempotency key and shows the pending security/forecast distinction', async () => {
    const fetch = vi.fn().mockResolvedValue(json(saved, 201));
    vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />);
    fill(saved.question);
    await screen.findByRole('article', { name: 'Generated decision brief' });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/decision-briefs');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
    expect(screen.getByText('At risk, needs human decision')).toBeTruthy();
    expect(screen.getByText(/conditional recommendation/i, { selector: '.disclosure' })).toBeTruthy();
    expect(screen.getByText('Not yet reviewed by a human.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /QA Forecast/ })).toBeTruthy();
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer member-token');
  });

  it('shows a controlled error and never a fabricated brief when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'secret internal failure' }, 503)));
    render(<DecisionBriefPanel />);
    fill(saved.question);
    expect((await screen.findByRole('alert')).textContent).toBe('Decision brief unavailable. Check the question and try again.');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('rejects a malformed response instead of rendering partial data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...saved, synthetic: false }, 201)));
    render(<DecisionBriefPanel />);
    fill(saved.question);
    await screen.findByRole('alert');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('rejects unsafe source links in evidence', async () => {
    const unsafe = { ...saved, brief: { ...saved.brief, supportingClaims: [{ claim: 'x', evidence: [{ ...evidence, sourceUrl: 'javascript:alert(1)' }] }] } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(unsafe, 201)));
    render(<DecisionBriefPanel />);
    fill(saved.question);
    await screen.findByRole('alert');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('records human review and states it is not production approval', async () => {
    const reviewed = { ...saved, reviewedByHuman: true, reviewedAt: '2026-10-16T02:00:00.000Z' };
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(saved, 201))
      .mockResolvedValueOnce(json(reviewed, 200));
    vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />);
    fill(saved.question);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark evidence reviewed' }));
    await screen.findByText(/This is not production approval/);
    expect(fetch.mock.calls[1][0]).toBe(`/api/decision-briefs/${saved.id}/review`);
    expect(screen.queryByRole('button', { name: 'Mark evidence reviewed' })).toBeNull();
  });

  it('keeps the review button available when review fails', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(saved, 201))
      .mockResolvedValueOnce(json({ error: 'nope' }, 500));
    vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />);
    fill(saved.question);
    const reviewButton = await screen.findByRole('button', { name: 'Mark evidence reviewed' });
    await act(async () => { fireEvent.click(reviewButton); });
    expect((await screen.findByRole('alert')).textContent).toBe('Review could not be recorded. Please try again.');
    expect(screen.getByRole('button', { name: 'Mark evidence reviewed' })).toBeTruthy();
  });
  it('retains the idempotency key after a failed request', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json(saved, 201));
    vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />);
    fill(saved.question);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Create brief' }));
    await screen.findByRole('article');
    expect(fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetch.mock.calls[1][1].headers['Idempotency-Key']);
  });

  it('lists, reopens, and loads the original source with member authorization', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ items: [saved] }))
      .mockResolvedValueOnce(json(saved))
      .mockResolvedValueOnce(json({ id: evidence.sourceId, title: evidence.sourceTitle, kind: 'google_doc',
        project: 'Harbour', owner: 'Fictional QA', recordedAt: evidence.recordedAt, effectiveAt: null,
        chunkCount: 1, content: evidence.excerpt, sourceUrl: evidence.sourceUrl, synthetic: true }));
    vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />);
    fireEvent.change(screen.getByLabelText('Member Firebase ID token'), { target: { value: 'member-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh saved briefs' }));
    fireEvent.click(await screen.findByRole('button', { name: saved.question }));
    fireEvent.click(await screen.findByRole('button', { name: /QA Forecast/ }));
    expect((await screen.findByRole('region', { name: 'Original source text' })).textContent).toBe(evidence.excerpt);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/decision-briefs', `/api/decision-briefs/${saved.id}`, evidence.sourceUrl]);
    for (const call of fetch.mock.calls) expect(call[1].headers.Authorization).toBe('Bearer member-token');
  });

  it('requires a member token before creating a brief', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Decision question' }), { target: { value: saved.question } });
    fireEvent.click(screen.getByRole('button', { name: 'Create brief' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter a member Firebase ID token.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('exposes both conflict excerpts and fails closed when original source lookup fails', async () => {
    const conflicted = { ...saved, brief: { ...saved.brief, supportingClaims: [], conflicts: [{
      description: 'Forecast differs from target.', type: 'timeline', left: evidence,
      right: { ...evidence, sourceId: 'HBR-DOC-02', sourceTitle: 'Client target', sourceUrl: '/api/sources/HBR-DOC-02', excerpt: 'Client target is 2026-11-01.' },
    }] } };
    const fetch = vi.fn().mockResolvedValueOnce(json(conflicted, 201)).mockResolvedValueOnce(json({}, 404));
    vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />); fill(saved.question);
    fireEvent.click(await screen.findByRole('button', { name: /Client target/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Source unavailable/);
    expect(screen.queryByRole('region', { name: 'Original source text' })).toBeNull();
    expect(screen.getByText(evidence.excerpt)).toBeTruthy();
  });

  it('prevents duplicate review requests while the first review is pending', async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(json(saved, 201)).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />); fill(saved.question);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark evidence reviewed' }));
    const pending = screen.getByRole('button', { name: 'Recording review...' }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);
    fireEvent.click(pending);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(async () => { finish(json({ ...saved, reviewedByHuman: true, reviewedAt: '2026-10-16T02:00:00.000Z' })); });
    await screen.findByText(/This is not production approval/);
  });

  it('blocks create, reopen and refresh while review is pending', async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(json(saved, 201))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />); fill(saved.question);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark evidence reviewed' }));
    for (const name of ['Create brief', saved.question, 'Refresh saved briefs']) {
      const button = screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    fireEvent.submit(screen.getByRole('textbox', { name: 'Decision question' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(async () => { finish(json({ ...saved, reviewedByHuman: true, reviewedAt: '2026-10-16T02:00:00.000Z' })); });
    await screen.findByText(/This is not production approval/);
  });

  it('blocks create, reopen and review until list refresh completes', async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(json(saved, 201))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetch);
    render(<DecisionBriefPanel />); fill(saved.question);
    await screen.findByRole('article');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh saved briefs' }));
    for (const name of ['Create brief', saved.question, 'Mark evidence reviewed']) {
      const button = screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
    fireEvent.submit(screen.getByRole('textbox', { name: 'Decision question' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(async () => { finish(json({ items: [saved] })); });
    expect((screen.getByRole('button', { name: 'Create brief' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('button', { name: saved.question })).toBeTruthy();
  });

});
