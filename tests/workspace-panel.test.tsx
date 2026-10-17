// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkspacePanel } from '../src/components/workspace-panel';
import { selectWorkspaceFiles } from '../src/lib/workspace-picker';

vi.mock('../src/lib/workspace-picker', () => ({ selectWorkspaceFiles: vi.fn() }));
const json = (body: unknown) => new Response(JSON.stringify(body));
const connected = { connected: true, sources: [] };
const imported = { connected: true, sources: [{ id: 'HBR-DOC-04', title: 'QA forecast', modifiedTime: '2026-10-10T00:00:00Z', importedAt: '2026-10-17T00:00:00Z', recordedAt: '2026-10-10', effectiveAt: null, chunkCount: 1 }] };
function mount() { render(<WorkspacePanel enabled configured />); fireEvent.change(screen.getByLabelText('Workspace member Firebase ID token'), { target: { value: 'member-one' } }); }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Workspace panel', () => {
  it('keeps local seed available when disabled', () => {
    render(<WorkspacePanel enabled={false} configured={false} />);
    expect(screen.getByText(/Synthetic seed corpus remains active/)).toBeTruthy();
    expect(screen.queryByText('Connect Google Workspace')).toBeNull();
    expect(screen.getByText('Disconnect and delete imported copies')).toBeTruthy();
  });
  it('discards an old member response after changing tokens', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    mount(); fireEvent.click(screen.getByText('Refresh Workspace status'));
    fireEvent.change(screen.getByLabelText('Workspace member Firebase ID token'), { target: { value: 'member-two' } });
    finish(json(imported));
    await waitFor(() => expect(screen.queryByText(/QA forecast/)).toBeNull());
    expect(screen.queryByText('Google connection verified.')).toBeNull();
  });
  it('requires explicit import confirmation, honors retry deadline and clears private data on disconnect', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(connected))
      .mockResolvedValueOnce(json({ accessToken: 'google-secret', developerKey: 'public-key', appId: 'app', expiresAt: Date.now() + 60000 }))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ ...connected, job: { status: 'queued', total: 1, completed: 0, failed: 0, searchable: 0, retryAt: Date.now() + 60000 } }))
      .mockResolvedValueOnce(json({ revocation: 'unconfirmed', cleanup: 'completed' }));
    vi.stubGlobal('fetch', fetch); vi.mocked(selectWorkspaceFiles).mockResolvedValue(['file-one']);
    mount(); fireEvent.click(screen.getByText('Refresh Workspace status'));
    fireEvent.click(await screen.findByText('Select fictional Docs or Sheets'));
    await screen.findByText(/1 selected files/);
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('Confirm import selected fictional files'));
    await screen.findByText(/Import paused for quota/);
    expect(fetch.mock.calls.some(call => String(call[0]).endsWith('import/step'))).toBe(false);
    expect(fetch.mock.calls[2][1].body).toBe(JSON.stringify({ fileIds: ['file-one'] }));
    fireEvent.click(screen.getByText('Disconnect and delete imported copies'));
    await screen.findByText(/Token revocation unconfirmed/);
    expect(screen.queryByText('Google connection verified.')).toBeNull();
    expect(fetch.mock.calls[4][1].headers.Authorization).toBe('Bearer member-one');
  });
  it('loads cited source through the authenticated private endpoint', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(imported)).mockResolvedValueOnce(json({ status: 'supported', mode: 'local', model: null, answer: 'Forecast is November 11.', claims: [{ claim: 'Forecast is November 11.', evidence: [{ sourceId: 'HBR-DOC-04', sourceTitle: 'QA forecast', excerpt: 'Completion forecast: November 11.' }] }], unknowns: [] }))
      .mockResolvedValueOnce(json({ title: 'QA forecast', content: 'Completion forecast: November 11.', recordedAt: '2026-10-10', effectiveAt: null }));
    vi.stubGlobal('fetch', fetch); mount(); fireEvent.click(screen.getByText('Refresh Workspace status'));
    await screen.findByText('Google connection verified.');
    fireEvent.change(screen.getByLabelText('Workspace question'), { target: { value: 'When is QA complete?' } });
    fireEvent.click(screen.getByText('Search Workspace selected files'));
    fireEvent.click(await screen.findByText('Inspect QA forecast'));
    await screen.findByRole('article', { name: 'Workspace source' });
    expect(fetch.mock.calls[2][0]).toBe('/api/workspace/sources/HBR-DOC-04');
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer member-one');
    fireEvent.change(screen.getByLabelText('Workspace member Firebase ID token'), { target: { value: 'member-two' } });
    expect(screen.queryByRole('article', { name: 'Workspace source' })).toBeNull();
    expect(screen.queryByRole('article', { name: 'Workspace answer' })).toBeNull();
  });
});
