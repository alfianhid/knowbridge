// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const sdk = vi.hoisted(() => ({ auth: { currentUser: null as unknown }, listener: null as unknown, login: vi.fn(), logout: vi.fn(), token: vi.fn(), claims: vi.fn() }));
vi.mock('firebase/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  browserSessionPersistence: {}, initializeAuth: () => sdk.auth, setPersistence: vi.fn().mockResolvedValue(undefined),
  onAuthStateChanged: (_auth: unknown, listener: (user: unknown) => void) => { sdk.listener = listener; listener(null); return vi.fn(); },
  signInWithEmailAndPassword: (...args: unknown[]) => sdk.login(...args), signOut: (...args: unknown[]) => sdk.logout(...args),
}));
import { JudgeSessionProvider, JudgeSignIn, useJudgeSession } from '../src/components/judge-session';
const config = { apiKey: 'public-demo-key', authDomain: 'demo.test', projectId: 'demo' };
const user = { uid: 'judge', getIdToken: sdk.token, getIdTokenResult: sdk.claims };
function TokenProbe() {
  const session = useJudgeSession();
  const [result, setResult] = React.useState('');
  return <><span>{session?.uid ?? 'anonymous'}</span><button onClick={() => { void session?.getToken().then(setResult).catch(() => setResult('denied')); }}>Request token</button><output>{result}</output></>;
}
function setup() { render(<JudgeSessionProvider config={config}><JudgeSignIn /><TokenProbe /></JudgeSessionProvider>); }
beforeEach(() => {
  vi.clearAllMocks(); sdk.auth.currentUser = null;
  sdk.claims.mockResolvedValue({ claims: { knowbridgeMember: true, knowbridgeTenant: 'demo-north-quay' } });
  sdk.token.mockResolvedValue('fresh-token');
  sdk.login.mockImplementation(async () => { sdk.auth.currentUser = user; (sdk.listener as (user: unknown) => void)(user); });
  sdk.logout.mockImplementation(async () => { sdk.auth.currentUser = null; (sdk.listener as (user: unknown) => void)(null); });
});
afterEach(cleanup);
async function login() {
  await waitFor(() => expect((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Judge email'), { target: { value: 'judge@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}
it('signs in, requests a refreshed SDK token on every operation, and signs out', async () => {
  setup(); await login();
  await screen.findByText('Signed in for protected demo features.');
  expect(sdk.login).toHaveBeenCalledWith(sdk.auth, 'judge@example.test', 'secret');
  fireEvent.click(screen.getByRole('button', { name: 'Request token' }));
  await screen.findByText('fresh-token');
  sdk.token.mockResolvedValue('next-token');
  fireEvent.click(screen.getByRole('button', { name: 'Request token' }));
  await screen.findByText('next-token');
  expect(sdk.token).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('button', { name: 'Sign in' });
  expect(sdk.logout).toHaveBeenCalledWith(sdk.auth);
  fireEvent.click(screen.getByRole('button', { name: 'Request token' }));
  await screen.findByText('denied');
});
it('shows a generic login error and clears the password', async () => {
  sdk.login.mockRejectedValue(new Error('sensitive provider detail'));
  setup(); await login();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('sensitive provider detail')).toBeNull();
  expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
});
it.each([
  { knowbridgeMember: true, knowbridgeTenant: 'other-tenant' },
  { knowbridgeMember: true, knowbridgeTenant: 'demo-north-quay', knowbridgeAccessUntil: 1 },
  { knowbridgeMember: true, knowbridgeTenant: 'demo-north-quay', knowbridgeAccessUntil: Number.NaN },
])('rejects unauthorized or expired claims before exposing protected access: %j', async (claims) => {
  sdk.claims.mockResolvedValue({ claims });
  setup(); await login();
  await screen.findByRole('alert');
  expect(screen.queryByText('Signed in for protected demo features.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Request token' }));
  await screen.findByText('denied');
  expect(sdk.token).not.toHaveBeenCalled();
});
