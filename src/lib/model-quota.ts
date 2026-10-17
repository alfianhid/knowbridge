import { createHash } from 'node:crypto';
import { ApiError } from './access';

// Durable daily model-call budget (OWASP LLM10/API4: unbounded consumption / denial-of-wallet).
// Cloud Run runs many instances, so an in-memory counter alone multiplies across instances and
// cannot cap real spend. When Firestore storage is active the budget is shared across instances via
// atomic transactions; local development and unit tests have no shared spend pool, so enforcement
// is a no-op there. This bounds model-bearing API requests. Each such request may invoke Gemini up
// to twice (generation plus semantic review), so the daily request budget is the modeled spend
// ceiling and is env-tunable.

const DAY_MS = 86_400_000;
const DEFAULT_DAILY_BUDGET = 300;
const DEFAULT_IDENTITY_DAILY_BUDGET = 100;
const TENANT_ID = 'demo-north-quay';

function positiveBudget(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isInteger(raw) && raw > 0 ? raw : fallback;
}

/** Global daily model-bearing request budget shared across every caller. */
export function modelDailyBudget(): number {
  return positiveBudget('KNOWBRIDGE_MODEL_DAILY_BUDGET', DEFAULT_DAILY_BUDGET);
}

/** Per-authenticated-identity daily budget for protected brief creation. */
export function identityDailyBudget(): number {
  return positiveBudget('KNOWBRIDGE_MODEL_IDENTITY_DAILY_BUDGET', DEFAULT_IDENTITY_DAILY_BUDGET);
}

export interface QuotaEntry {
  key: string;
  limit: number;
}

export interface QuotaBackend {
  /** Increments every entry only when all are within their limit; otherwise increments none. */
  consume(entries: QuotaEntry[], window: number): Promise<boolean>;
}

export class MemoryQuotaBackend implements QuotaBackend {
  private readonly counts = new Map<string, { window: number; count: number }>();

  async consume(entries: QuotaEntry[], window: number): Promise<boolean> {
    if (entries.some(entry => this.current(entry.key, window) >= entry.limit)) return false;
    for (const entry of entries) this.counts.set(entry.key, { window, count: this.current(entry.key, window) + 1 });
    return true;
  }

  private current(key: string, window: number): number {
    const record = this.counts.get(key);
    return record?.window === window ? record.count : 0;
  }

  reset(): void {
    this.counts.clear();
  }
}

class FirestoreQuotaBackend implements QuotaBackend {
  async consume(entries: QuotaEntry[], window: number): Promise<boolean> {
    // Lazy import keeps firebase-admin out of local/test module graphs unless Firestore is active.
    const { getDatabase } = await import('./firebase');
    const database = getDatabase();
    return database.runTransaction(async transaction => {
      const references = entries.map(entry => database.doc(`tenants/${TENANT_ID}/modelQuotas/${entry.key}`));
      const counts: number[] = [];
      for (const reference of references) {
        const snapshot = await transaction.get(reference);
        const data = snapshot.data();
        counts.push(data?.window === window ? Number(data?.count ?? 0) : 0);
      }
      if (entries.some((entry, index) => counts[index] >= entry.limit)) return false;
      entries.forEach((entry, index) => transaction.set(references[index], { window, count: counts[index] + 1 }));
      return true;
    });
  }
}

function retryAfterSeconds(now: number, window: number): number {
  return Math.max(1, Math.ceil(((window + 1) * DAY_MS - now) / 1000));
}

/** Budget entries to check: a per-identity cap when `principal` is supplied, plus the global cap. */
export function modelBudgetEntries(principal?: string | null): QuotaEntry[] {
  const entries: QuotaEntry[] = [];
  if (principal) entries.push({ key: `p_${createHash('sha256').update(principal).digest('hex')}`, limit: identityDailyBudget() });
  entries.push({ key: 'global', limit: modelDailyBudget() });
  return entries;
}

/**
 * Consume one model-bearing request against the given budget entries. Throws `ApiError(429)` with
 * `retryAfterSeconds` set to the seconds remaining in the current UTC day window when exhausted.
 */
export async function consumeQuota(entries: QuotaEntry[], now: number, quotaBackend: QuotaBackend): Promise<void> {
  const window = Math.floor(now / DAY_MS);
  const allowed = await quotaBackend.consume(entries, window);
  if (!allowed) throw new ApiError(429, 'Model request budget reached for today. Please retry later.', retryAfterSeconds(now, window));
}

function cloudMode(): boolean {
  return (process.env.KNOWBRIDGE_STORE ?? (process.env.K_SERVICE ? 'firestore' : 'file')) === 'firestore';
}

/**
 * Route entry point. Enforces the durable budget only where a shared spend pool exists (Cloud Run
 * with Firestore); local development and unit tests have no shared spend pool, so this is a no-op
 * there and keeps test suites independent of budget state. Pass `quotaBackend` to force a backend
 * (used by tests to exercise the accounting deterministically).
 */
export async function consumeModelBudget(principal?: string | null, now = Date.now(), quotaBackend?: QuotaBackend): Promise<void> {
  const active = quotaBackend ?? (cloudMode() ? new FirestoreQuotaBackend() : null);
  if (!active) return;
  await consumeQuota(modelBudgetEntries(principal), now, active);
}
