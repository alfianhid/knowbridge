'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import { browserSessionPersistence, initializeAuth, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut, type Auth, type User } from 'firebase/auth';

type JudgeConfig = { apiKey: string; authDomain: string; projectId: string };
type JudgeSession = { uid: string | null; configured: boolean; getToken: () => Promise<string> };
type SessionControls = JudgeSession & { ready: boolean; error: string; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> };
const SessionContext = createContext<SessionControls | null>(null);

async function checkMember(user: User) {
  const { claims } = await user.getIdTokenResult();
  if (claims.knowbridgeMember !== true || claims.knowbridgeTenant !== 'demo-north-quay'
    || (claims.knowbridgeAccessUntil !== undefined && (typeof claims.knowbridgeAccessUntil !== 'number' || !Number.isFinite(claims.knowbridgeAccessUntil) || claims.knowbridgeAccessUntil <= Date.now() / 1000))) {
    throw new Error('Judge access unavailable.');
  }
}

export function useJudgeSession(): JudgeSession | null { return useContext(SessionContext); }

export function JudgeSessionProvider({ config, children }: { config: JudgeConfig | null; children: React.ReactNode }) {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const apiKey = config?.apiKey;
  const authDomain = config?.authDomain;
  const projectId = config?.projectId;
  useEffect(() => {
    if (!apiKey || !authDomain || !projectId) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const app = getApps().find((item) => item.name === 'knowbridge-judge') ?? initializeApp({ apiKey, authDomain, projectId }, 'knowbridge-judge');
    const instance = initializeAuth(app, { persistence: browserSessionPersistence });
    void setPersistence(instance, browserSessionPersistence).then(() => {
      if (!active) return;
      setAuth(instance);
      unsubscribe = onAuthStateChanged(instance, (user) => {
        setUid(null);
        setReady(false);
        if (!user) { setReady(true); return; }
        void checkMember(user).then(() => {
          if (active && instance.currentUser === user) { setUid(user.uid); setReady(true); setError(''); }
        }).catch(() => {
          if (active && instance.currentUser === user) { setReady(true); setError('Judge access unavailable. Contact the demo operator.'); }
        });
      });
    }).catch(() => { if (active) setError('Sign-in unavailable. Please try again later.'); });
    return () => { active = false; unsubscribe?.(); };
  }, [apiKey, authDomain, projectId]);

  const value: SessionControls = {
    uid, configured: Boolean(config), ready, error,
    getToken: async () => {
      const user = auth?.currentUser;
      if (!user || user.uid !== uid) throw new Error('Sign in to use protected features.');
      await checkMember(user);
      const token = await user.getIdToken();
      if (auth.currentUser !== user) throw new Error('Session changed. Please try again.');
      return token;
    },
    login: async (email, password) => {
      if (!auth) throw new Error('Sign-in unavailable.');
      setError('');
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    logout: async () => {
      if (auth) await signOut(auth);
      setUid(null); setError('');
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function JudgeSignIn() {
  const session = useContext(SessionContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!session?.configured) return null;
  return <section aria-label="Judge access">
    <h2>Judge access</h2>
    {session.uid ? <><p>Signed in for protected demo features.</p><button type="button" disabled={pending} onClick={async () => {
      setPending(true); setError('');
      try { await session.logout(); } catch { setError('Sign-out failed. Please try again.'); } finally { setPending(false); }
    }}>Sign out</button></> : <form onSubmit={async (event) => {
      event.preventDefault(); setPending(true); setError('');
      try { await session.login(email, password); } catch { setError('Unable to sign in. Check your credentials or contact the demo operator.'); }
      finally { setPassword(''); setPending(false); }
    }}>
      <p>Use the judge account supplied by the demo operator. Access is limited to fictional demo data.</p>
      <p>Judge accounts remain available through 6 November 2026 (WIB). Sessions renew automatically; sign in again when using a new browser session.</p>
      <label htmlFor="judge-email">Judge email</label><input id="judge-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <label htmlFor="judge-password">Password</label><input id="judge-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      <button type="submit" disabled={pending || !session.ready}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>}
    {(error || session.error) && <p role="alert">{error || session.error}</p>}
  </section>;
}
