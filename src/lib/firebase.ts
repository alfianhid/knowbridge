import { applicationDefault, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export function getAdminApp(): App {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT is required.');
  return getApps().find(app => app.name === 'knowbridge') ?? initializeApp({
    credential: applicationDefault(), projectId,
  }, 'knowbridge');
}

export function getDatabase(): Firestore {
  return getFirestore(getAdminApp(), process.env.FIRESTORE_DATABASE_ID ?? '(default)');
}
