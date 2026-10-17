// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectWorkspaceFiles } from '../src/lib/workspace-picker';

afterEach(() => { vi.useRealTimers(); document.querySelectorAll('script[src="https://apis.google.com/js/api.js"]').forEach(script => script.remove()); });
const config = () => ({ accessToken: 'fictional-test-token', developerKey: 'public-key', appId: 'project-number', expiresAt: Date.now() + 60000 });

describe('Picker script failure recovery', () => {
  it('times out a stalled script download without leaving an import pending', async () => {
    vi.useFakeTimers();
    const result = expect(selectWorkspaceFiles(config(), 'test-nonce')).rejects.toThrow('timed out');
    expect(document.querySelector('script')?.nonce).toBe('test-nonce');
    await vi.advanceTimersByTimeAsync(15000);
    await result;
    expect(document.querySelector('script')).toBeNull();
  });
  it('aborts during script load and removes the pending script', async () => {
    const controller = new AbortController();
    const result = expect(selectWorkspaceFiles(config(), undefined, controller.signal)).rejects.toThrow('cancelled');
    controller.abort();
    await result;
    expect(document.querySelector('script')).toBeNull();
  });
});
