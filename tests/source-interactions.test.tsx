// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SourceExplorer } from '../src/components/source-explorer';

const summaries = ['HBR-DOC-01', 'HBR-DOC-02'].map((id, i) => ({ id, title: `Source ${i + 1}`, kind: 'google_doc' as const, project: 'HBR', recordedAt: '2026-10-07', sourceUrl: `/api/sources/${id}`, chunkCount: 1 }));
const detail = (index: number) => ({ ...summaries[index], owner: 'Fictional owner', effectiveAt: null, content: `SECTION\nLiteral evidence ${index + 1}.`, synthetic: true });
const response = (index: number) => new Response(JSON.stringify(detail(index)), { status: 200 });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('source explorer async behavior', () => {
  it('ignores an abandoned fetch even if abort is ignored', async () => {
    let resolveFirst!: (response: Response) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveFirst = resolve; })).mockResolvedValueOnce(response(1));
    vi.stubGlobal('fetch', fetch);
    render(<SourceExplorer sources={summaries} />);
    fireEvent.click(screen.getByRole('button', { name: /Source 2/ }));
    await screen.findByRole('region', { name: 'Source 2 evidence' });
    await act(async () => { resolveFirst(response(0)); });
    expect(screen.queryByRole('region', { name: 'Source 1 evidence' })).toBeNull();
    expect(screen.getByRole('button', { name: /Source 2/ }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Loaded Source 2.');
    expect(screen.getByRole('region', { name: 'Source 2 evidence' }).getAttribute('tabindex')).toBe('0');
  });
  it('retries failed details and preserves exact original text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response(0)));
    render(<SourceExplorer sources={summaries} />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('region', { name: 'Source 1 evidence' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('region', { name: 'Original source text', hidden: true }).textContent).toBe(detail(0).content);
    await waitFor(() => expect(screen.getByRole('complementary').getAttribute('aria-busy')).toBe('false'));
  });
  it('does not fetch for an empty catalog', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<SourceExplorer sources={[]} />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('No synthetic evidence has been imported.')).toBeTruthy();
  });
});
