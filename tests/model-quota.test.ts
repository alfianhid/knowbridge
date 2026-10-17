import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/lib/access';
import {
  consumeModelBudget, consumeQuota, identityDailyBudget, MemoryQuotaBackend, modelBudgetEntries, modelDailyBudget,
} from '../src/lib/model-quota';

const DAY = 24 * 60 * 60 * 1000;

describe('model budget accounting', () => {
  it('enforces the global budget and reports Retry-After until the next day window', async () => {
    const backend = new MemoryQuotaBackend();
    const start = Date.UTC(2026, 9, 17, 12, 0, 0);
    for (let i = 0; i < modelDailyBudget(); i++) await consumeQuota([{ key: 'global', limit: modelDailyBudget() }], start, backend);
    const error = await consumeQuota([{ key: 'global', limit: modelDailyBudget() }], start, backend).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(429);
    expect((error as ApiError).retryAfterSeconds).toBeGreaterThan(0);
    expect((error as ApiError).retryAfterSeconds).toBeLessThanOrEqual(86400);
  });

  it('resets the budget when the UTC day window rolls over', async () => {
    const backend = new MemoryQuotaBackend();
    const start = Date.UTC(2026, 9, 17, 23, 59, 59);
    for (let i = 0; i < 3; i++) await consumeQuota([{ key: 'global', limit: 3 }], start, backend);
    await expect(consumeQuota([{ key: 'global', limit: 3 }], start, backend)).rejects.toThrow(ApiError);
    await expect(consumeQuota([{ key: 'global', limit: 3 }], start + DAY, backend)).resolves.toBeUndefined();
  });

  it('counts every request and blocks only over the limit', async () => {
    const backend = new MemoryQuotaBackend();
    const now = Date.UTC(2026, 9, 17, 0, 0, 0);
    await consumeQuota([{ key: 'global', limit: 2 }], now, backend);
    await consumeQuota([{ key: 'global', limit: 2 }], now, backend);
    await expect(consumeQuota([{ key: 'global', limit: 2 }], now, backend)).rejects.toThrow('budget reached');
  });

  it('atomically increments all entries only when none is over its limit', async () => {
    const backend = new MemoryQuotaBackend();
    const now = Date.UTC(2026, 9, 17, 0, 0, 0);
    // Identity limit reached while global has room: nothing may be incremented.
    const entries = [{ key: 'p_a', limit: 1 }, { key: 'global', limit: 5 }];
    await consumeQuota(entries, now, backend);
    await expect(consumeQuota(entries, now, backend)).rejects.toThrow(ApiError);
    // Global must still be at 1 (not 2) because the second attempt incremented nothing.
    await consumeQuota([{ key: 'global', limit: 2 }], now, backend);
    await expect(consumeQuota([{ key: 'global', limit: 2 }], now, backend)).rejects.toThrow(ApiError);
  });

  it('tracks identities independently under a shared global cap', async () => {
    const backend = new MemoryQuotaBackend();
    const now = Date.UTC(2026, 9, 17, 0, 0, 0);
    const entries = (principal: string) => modelBudgetEntries(principal);
    await consumeQuota(entries('user-a'), now, backend);
    await consumeQuota(entries('user-b'), now, backend);
    // Each identity has its own budget, so a second call per identity is allowed.
    await expect(consumeQuota(entries('user-a'), now, backend)).resolves.toBeUndefined();
  });

  it('builds per-identity plus global entries and honors env overrides', () => {
    const entries = modelBudgetEntries('user-a');
    expect(entries.map(entry => entry.key.startsWith('p_'))).toEqual([true, false]);
    expect(entries[1].key).toBe('global');
    expect(entries[0].limit).toBe(identityDailyBudget());
    expect(entries[1].limit).toBe(modelDailyBudget());
    const previous = process.env.KNOWBRIDGE_MODEL_DAILY_BUDGET;
    process.env.KNOWBRIDGE_MODEL_DAILY_BUDGET = '5';
    expect(modelDailyBudget()).toBe(5);
    if (previous === undefined) delete process.env.KNOWBRIDGE_MODEL_DAILY_BUDGET;
    else process.env.KNOWBRIDGE_MODEL_DAILY_BUDGET = previous;
    expect(modelBudgetEntries(null).length).toBe(1);
  });
});

describe('consumeModelBudget routing', () => {
  it('is a no-op without a shared spend pool and enforces when a backend is supplied', async () => {
    const previous = process.env.KNOWBRIDGE_STORE;
    process.env.KNOWBRIDGE_STORE = 'file';
    await expect(consumeModelBudget('user-a')).resolves.toBeUndefined();
    process.env.KNOWBRIDGE_STORE = previous;
    const backend = new MemoryQuotaBackend();
    for (let i = 0; i < identityDailyBudget(); i++) await consumeModelBudget('user-a', Date.now(), backend);
    await expect(consumeModelBudget('user-a', Date.now(), backend)).rejects.toThrow(ApiError);
  });
});
