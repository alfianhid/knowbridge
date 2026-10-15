// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AskPanel } from '../src/components/ask-panel';

const result = {
  status: 'supported', answer: 'QA forecast is 2026-11-11.',
  claims: [{ claim: 'QA forecast', evidence: [{ sourceId: 'HBR-DOC-04',
    excerpt: 'QA completion forecast: 2026-11-11.\nApproval remains pending.',
    sourceTitle: 'QA Forecast', sourceUrl: '/api/sources/HBR-DOC-04',
    recordedAt: '2026-10-10', effectiveAt: null }] }],
  unknowns: ['No pilot approval evidence.'], mode: 'local', model: null, synthetic: true,
};
const response = (body: unknown) => new Response(JSON.stringify(body));
function submit() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Question' }), { target: { value: '  Can Harbour launch?  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Ask evidence interaction', () => {
  it('explains the minimum trimmed question length without fetching', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<AskPanel />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Question' }), { target: { value: ' a  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a question with at least 4 characters.');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('submits a question and renders exact evidence, links and local disclosure', async () => {
    const fetch = vi.fn().mockResolvedValue(response(result));
    vi.stubGlobal('fetch', fetch);
    render(<AskPanel />);
    submit();
    await screen.findByRole('region', { name: 'Grounded answer' });
    expect(fetch).toHaveBeenCalledWith('/api/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Can Harbour launch?' }),
    });
    expect(screen.getByText('Local deterministic evidence lookup; no AI synthesis.')).toBeTruthy();
    expect(screen.getByRole('blockquote').textContent).toBe(result.claims[0].evidence[0].excerpt);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/api/sources/HBR-DOC-04');
    expect(screen.getByText('No pilot approval evidence.')).toBeTruthy();
  });

  it('disables submission while pending and announces insufficient evidence', async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetch);
    render(<AskPanel />);
    submit();
    expect(screen.getByRole('button', { name: 'Ask' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Searching authorized evidence…');
    await act(async () => resolve(response({ ...result, status: 'insufficient_evidence', answer: 'Insufficient evidence.', claims: [] })));
    expect(await screen.findByRole('heading', { name: 'Insufficient evidence' })).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it.each(['network', 'server', 'invalid'])('shows controlled %s errors and permits retry', async kind => {
    const fetch = vi.fn();
    if (kind === 'network') fetch.mockRejectedValueOnce(new Error('secret internal failure'));
    else fetch.mockResolvedValueOnce(kind === 'server' ? new Response('secret internal failure', { status: 500 }) : response({ ...result, synthetic: false }));
    fetch.mockResolvedValueOnce(response(result));
    vi.stubGlobal('fetch', fetch);
    render(<AskPanel />);
    submit();
    expect((await screen.findByRole('alert')).textContent).toBe('Answer unavailable. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await screen.findByRole('region', { name: 'Grounded answer' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rejects unsafe source links from a malformed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...result,
      claims: [{ claim: 'QA forecast', evidence: [{ ...result.claims[0].evidence[0], sourceUrl: 'javascript:alert(1)' }] }],
    })));
    render(<AskPanel />);
    submit();
    await screen.findByRole('alert');
    expect(screen.queryByRole('link')).toBeNull();
  });
});
