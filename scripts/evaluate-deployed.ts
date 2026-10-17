// Deployed-API benchmark: runs the 12 evaluation fixtures against the live Cloud Run
// /api/ask endpoint and independently verifies literal citations through /api/sources.
// Scoring matches scripts/evaluate.ts. No local model/store access is used.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';

const fixtureSchema = z.array(z.object({
  id: z.string(), question: z.string(), expected: z.string(), required_source_ids: z.array(z.string()),
  facts: z.object({ original_target: z.string(), qa_forecast: z.string(), security: z.string() }).passthrough().optional(),
}));

interface EvidenceRef { sourceId: string; excerpt: string }
interface AskResponse { status: string; answer: string; claims: { claim: string; evidence: EvidenceRef[] }[]; unknowns?: string[] }

const DEFAULT_BASE = 'https://knowbridge-208529907910.asia-southeast1.run.app';

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 240_000): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    let body: unknown = null;
    try { body = await response.json(); } catch { body = null; }
    return { status: response.status, body };
  } finally { clearTimeout(timer); }
}

async function main(): Promise<void> {
  const args = process.argv.slice(3);
  const base = (args.find(arg => arg.startsWith('--url='))?.slice(6) || process.env.KNOWBRIDGE_EVAL_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const revision = args.find(arg => arg.startsWith('--revision='))?.slice(11) || 'unknown';
  const selectedId = args.find(arg => arg.startsWith('--case='))?.slice(7);
  const allFixtures = fixtureSchema.parse(JSON.parse(await readFile('seed/generated/evaluation.json', 'utf8')));
  if (selectedId && !allFixtures.some(item => item.id === selectedId)) throw new Error('Invalid evaluation case.');
  const fixtures = selectedId ? allFixtures.filter(item => item.id === selectedId) : allFixtures;
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = args.find(arg => arg.startsWith('--out='))?.slice(6)
    || `.data/evaluations/deployed-${selectedId || 'full'}-${runId}.json`;

  const sourceCache = new Map<string, string>();
  let askCalls = 0;
  let sourceLookups = 0;
  const verifySource = async (sourceId: string): Promise<string | undefined> => {
    if (sourceCache.has(sourceId)) return sourceCache.get(sourceId);
    sourceLookups += 1;
    const { status, body } = await fetchJson(`${base}/api/sources/${encodeURIComponent(sourceId)}`);
    const content = status === 200 && body && typeof body === 'object' && typeof (body as { content?: unknown }).content === 'string'
      ? (body as { content: string }).content : undefined;
    if (content !== undefined) sourceCache.set(sourceId, content);
    return content;
  };

  const results: {
    id: string; question: string; expected: string; timestamp: string; latencyMs: number; requiredSourceIds: string[];
    citedSourceIds: string[]; missingRequiredIds: string[]; literalCitationsValid: boolean; factCoverage: boolean;
    automatedPassed: boolean; humanReview: 'pending'; response?: AskResponse; error?: string; errorStatus?: number;
  }[] = [];
  await mkdir(dirname(outPath), { recursive: true });

  for (const fixture of fixtures) {
    const started = Date.now();
    const base0 = { id: fixture.id, question: fixture.question, expected: fixture.expected, timestamp: new Date().toISOString(),
      requiredSourceIds: fixture.required_source_ids, humanReview: 'pending' as const };
    try {
      askCalls += 1;
      const asked = await fetchJson(`${base}/api/ask`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: fixture.question }),
      });
      if (asked.status !== 200 || !asked.body || typeof asked.body !== 'object') {
        const message = asked.body && typeof asked.body === 'object' && typeof (asked.body as { error?: unknown }).error === 'string'
          ? (asked.body as { error: string }).error : 'Deployed service request failed; no model pass claimed.';
        throw Object.assign(new Error(message), { status: asked.status });
      }
      const response = asked.body as AskResponse;
      const refs = response.claims.flatMap(claim => claim.evidence);
      const citedSourceIds = [...new Set(refs.map(item => item.sourceId))];
      const missingRequiredIds = fixture.required_source_ids.filter(id => !citedSourceIds.includes(id));
      let literalCitationsValid = true;
      for (const ref of refs) {
        const content = await verifySource(ref.sourceId);
        if (content === undefined || !content.includes(ref.excerpt)) { literalCitationsValid = false; break; }
      }
      const factCoverage = !fixture.facts || [fixture.facts.original_target, fixture.facts.qa_forecast, fixture.facts.security.toLowerCase()]
        .every(fact => response.answer.toLowerCase().includes(fact));
      const expectedStatus = fixture.required_source_ids.length ? 'supported' : 'insufficient_evidence';
      const automatedPassed = response.status === expectedStatus && !missingRequiredIds.length && literalCitationsValid && factCoverage;
      results.push({ ...base0, latencyMs: Date.now() - started, citedSourceIds, missingRequiredIds, literalCitationsValid, factCoverage, automatedPassed, response });
    } catch (error: unknown) {
      const errorStatus = error instanceof Error && 'status' in error && typeof error.status === 'number' && Number.isInteger(error.status) ? error.status : undefined;
      results.push({ ...base0, latencyMs: Date.now() - started, citedSourceIds: [], missingRequiredIds: fixture.required_source_ids,
        literalCitationsValid: false, factCoverage: false, automatedPassed: false, errorStatus,
        error: error instanceof Error ? error.message : 'Deployed service request failed; no model pass claimed.' });
    }
    const latencies = results.map(item => item.latencyMs).sort((a, b) => a - b);
    const mid = Math.floor(latencies.length / 2);
    const medianLatencyMs = latencies.length % 2 ? latencies[mid] : (latencies[mid - 1] + latencies[mid]) / 2;
    const report = {
      timestamp: new Date().toISOString(), url: base, revision,
      latencyDefinition: 'HTTP /api/ask request plus independent authorized /api/sources citation verification; includes failed cases.',
      runScope: selectedId ? 'deployed-api-selected-case-retry' : 'full-deployed-api-suite',
      suiteFixtures: allFixtures.length, totalFixtures: fixtures.length, completed: results.length,
      automatedPassed: results.filter(item => item.automatedPassed).length, automatedFailed: results.filter(item => !item.automatedPassed).length,
      humanReviewed: 0, humanSemanticPasses: null, medianLatencyMs,
      requestCounts: { askCalls, sourceLookups },
      results,
    };
    await writeFile(outPath, JSON.stringify(report, null, 2));
    const last = results[results.length - 1];
    console.log(JSON.stringify({ id: last.id, automatedPassed: last.automatedPassed, missingRequiredIds: last.missingRequiredIds, latencyMs: last.latencyMs, errorStatus: last.errorStatus, error: last.error }));
    // Shared embedding quota is five starts/minute; pace cases like scripts/evaluate.ts.
    const wait = 15_000 - (Date.now() - started);
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  }
  console.log(JSON.stringify({ completed: results.length, automatedPassed: results.filter(item => item.automatedPassed).length,
    automatedFailed: results.filter(item => !item.automatedPassed).length, requestCounts: { askCalls, sourceLookups }, report: outPath }));
  if (results.some(item => !item.automatedPassed)) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Deployed evaluation unavailable.'); console.error('No benchmark pass claimed.'); process.exitCode = 1; });
