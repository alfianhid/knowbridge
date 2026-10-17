// Trusted operator CLI. Writes passwords only to an operator-protected, ignored local file.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { randomBytes } = require('node:crypto');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const PROJECT = 'project-abfa2050-4777-4f90-bf0';
const ORIGIN = 'https://knowbridge-208529907910.asia-southeast1.run.app';
const UNTIL = Date.parse('2026-11-07T00:00:00+07:00') / 1000;
let stage = 'inputs';
async function main() {
  const operatorToken = process.env.KNOWBRIDGE_OPERATOR_ACCESS_TOKEN;
  const apiKey = process.env.KNOWBRIDGE_FIREBASE_API_KEY;
  if (!operatorToken || !apiKey) throw new Error('operator-inputs-missing');
  stage = 'enable-password-provider';
  const config = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, {
    method: 'PATCH', headers: { authorization: `Bearer ${operatorToken}`, 'content-type': 'application/json', 'x-goog-user-project': PROJECT },
    body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }), signal: AbortSignal.timeout(30000),
  });
  if (!config.ok) throw new Error(`provider-config-${config.status}`);
  const auth = getAuth(initializeApp({ projectId: PROJECT, credential: applicationDefault() }));
  // Refuse to overwrite an existing credential handoff. Partial runs retain credentials for recovery.
  const path = join(process.cwd(), '.data', 'judge-access', 'credentials.txt');
  await writeFile(path, `KnowBridge fictional judge accounts\nURL: ${ORIGIN}/#judge-signin\nAccess ends: 2026-11-07 00:00 WIB (after judging on 6 November).\nKeep private. Share via the competition's private credential field, never a public repository or demo page.\n`, { flag: 'wx', mode: 0o600 });
  const { appendFile } = require('node:fs/promises');
  for (let index = 1; index <= 3; index++) {
    const uid = `knowbridge-judge-${String(index).padStart(2, '0')}`;
    const email = `${uid}@demo.knowbridge.example`;
    const password = randomBytes(24).toString('base64url');
    stage = `create-${uid}`;
    // Record before creation so a handled/network failure cannot strand an unknown password.
    await appendFile(path, `\n${uid}\nEmail: ${email}\nPassword: ${password}\n`, { mode: 0o600 });
    await auth.createUser({ uid, email, password, displayName: `Fictional Judge ${index}`, disabled: false });
    await auth.setCustomUserClaims(uid, { knowbridgeMember: true, knowbridgeTenant: 'demo-north-quay', knowbridgeAccessUntil: UNTIL });
    stage = `verify-${uid}`;
    const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }), signal: AbortSignal.timeout(30000),
    });
    if (!login.ok) throw new Error(`password-login-${login.status}`);
    const session = await login.json();
    // Exercise the same refresh-token exchange used by the browser SDK; never persist it.
    const renewal = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refreshToken }), signal: AbortSignal.timeout(30000),
    });
    if (!renewal.ok) throw new Error(`token-renewal-${renewal.status}`);
    const renewed = await renewal.json();
    const identity = await auth.verifyIdToken(renewed.id_token, true);
    if (identity.uid !== uid || identity.knowbridgeMember !== true || identity.knowbridgeAdmin === true || identity.knowbridgeAccessUntil !== UNTIL) throw new Error('unexpected-claims');
    const headers = { authorization: `Bearer ${renewed.id_token}` };
    for (const route of ['/api/decision-briefs', '/api/workspace/status']) {
      const response = await fetch(`${ORIGIN}${route}`, { headers, signal: AbortSignal.timeout(30000) });
      if (response.status !== 200) throw new Error(`member-access-${response.status}`);
    }
    const ingest = await fetch(`${ORIGIN}/api/ingest`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000) });
    if (ingest.status !== 403) throw new Error('ingestion-denial-missing');
    console.log(JSON.stringify({ uid, passwordSignIn: true, tokenRenewal: true, memberAccess: true, ingestionDenied: true, cutoff: '2026-11-07T00:00:00+07:00' }));
  }
  console.log('Private credential handoff saved in .data/judge-access/credentials.txt. No passwords or tokens printed.');
}
main().catch(error => {
  console.error(JSON.stringify({ provisioned: false, stage,
    diagnostic: error instanceof Error && /^(operator-inputs|provider-config-|password-login-|token-renewal-|unexpected-claims|member-access-|ingestion-denial)/.test(error.message) ? error.message : 'operator-provision-failed',
    code: typeof error?.code === 'string' && /^[a-z0-9_/-]+$/i.test(error.code) ? error.code : undefined }));
  process.exitCode = 1;
});
