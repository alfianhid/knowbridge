type PickerConfig = { accessToken: string; developerKey: string; appId: string; expiresAt: number };
type Picker = { setVisible(value: boolean): void; dispose(): void };
type View = { setOwnedByMe(value: boolean): View; setMimeTypes(value: string): View };
type Builder = { addView(view: View): Builder; setOAuthToken(value: string): Builder; setDeveloperKey(value: string): Builder; setAppId(value: string): Builder; setOrigin(value: string): Builder; enableFeature(value: string): Builder; setMaxItems(value: number): Builder; setCallback(callback: (data: { action: string; docs?: { id: string }[] }) => void): Builder; build(): Picker };
type PickerWindow = Window & { gapi?: { load(name: string, options: { callback(): void; onerror(): void; timeout: number; ontimeout(): void }): void }; google?: { picker: { DocsView: new () => View; PickerBuilder: new () => Builder; Feature: { MULTISELECT_ENABLED: string } } } };

function loadPicker(browser: PickerWindow, nonce?: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let script: HTMLScriptElement | undefined;
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      if (script) { script.onload = null; script.onerror = null; if (error) script.remove(); }
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new Error('Picker cancelled'));
    const timeout = setTimeout(() => finish(new Error('Picker timed out')), 15000);
    const module = () => {
      if (finished) return;
      if (!browser.gapi) { finish(new Error('Picker unavailable')); return; }
      try { browser.gapi.load('picker', { callback: () => finish(), onerror: () => finish(new Error('Picker unavailable')),
        timeout: 15000, ontimeout: () => finish(new Error('Picker timed out')) }); }
      catch { finish(new Error('Picker unavailable')); }
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    if (browser.gapi) { module(); return; }
    script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    if (nonce) script.nonce = nonce;
    script.onload = module;
    script.onerror = () => finish(new Error('Picker unavailable'));
    document.head.appendChild(script);
  });
}

export async function selectWorkspaceFiles(config: PickerConfig, nonce?: string, signal?: AbortSignal): Promise<string[]> {
  const browser = window as PickerWindow;
  try { await loadPicker(browser, nonce, signal); }
  catch (error) { config = { accessToken: '', developerKey: '', appId: '', expiresAt: 0 }; throw error; }
  if (signal?.aborted || config.expiresAt <= Date.now()) { config = { accessToken: '', developerKey: '', appId: '', expiresAt: 0 }; throw new Error('Picker expired'); }
  return new Promise((resolve, reject) => {
    let picker: Picker | undefined;
    let done = false;
    const finish = (ids?: string[]) => {
      if (done) return;
      done = true;
      signal?.removeEventListener('abort', abort);
      picker?.setVisible(false); picker?.dispose(); picker = undefined;
      config = { accessToken: '', developerKey: '', appId: '', expiresAt: 0 };
      if (ids) resolve(ids); else reject(new Error('Picker cancelled'));
    };
    const abort = () => finish();
    try {
    const api = browser.google!.picker;
    picker = new api.PickerBuilder().addView(new api.DocsView().setOwnedByMe(true).setMimeTypes('application/vnd.google-apps.document,application/vnd.google-apps.spreadsheet'))
      .setOAuthToken(config.accessToken).setDeveloperKey(config.developerKey).setAppId(config.appId).setOrigin(location.origin)
      .enableFeature(api.Feature.MULTISELECT_ENABLED).setMaxItems(3)
      .setCallback(data => { if (data.action === 'picked') finish((data.docs ?? []).map(doc => doc.id).slice(0, 3)); else if (data.action === 'cancel') finish([]); }).build();
    signal?.addEventListener('abort', abort, { once: true });
    picker.setVisible(true);
    } catch { finish(); }
  });
}
