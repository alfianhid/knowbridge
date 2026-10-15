import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { askQuestion, type AskResponse } from '../src/lib/ask';
import { getAIConfig } from '../src/lib/gemini';
import { getSourceStore } from '../src/lib/source-store';
import { DEMO_TENANT_ID } from '../src/lib/sources';
import { ApiError } from '../src/lib/access';

const fixtureSchema = z.array(z.object({
  id: z.string(), question: z.string(), expected: z.string(), required_source_ids: z.array(z.string()),
  facts: z.object({ original_target: z.string(), qa_forecast: z.string(), security: z.string() }).passthrough().optional(),
}));

async function main(): Promise<void> {
  if (process.env.KNOWBRIDGE_STORE !== 'firestore' || process.env.KNOWBRIDGE_RETRIEVAL !== 'vertex') throw new Error('Live evaluation requires Firestore/Vertex.');
  const allFixtures = fixtureSchema.parse(JSON.parse(await readFile('seed/generated/evaluation.json', 'utf8')));
  const args = process.argv.slice(3);
  const selectedId = args[0]?.startsWith('--case=') ? args[0].slice(7) : undefined;
  if (args.length > 1 || (args.length && !allFixtures.some(item => item.id === selectedId))) throw new Error('Invalid evaluation case.');
  const fixtures = selectedId ? allFixtures.filter(item => item.id === selectedId) : allFixtures;
  const reportPath = selectedId ? `.data/evaluation-retry-${selectedId}.json` : '.data/evaluation-results.json';
  const sources = await getSourceStore().list(DEMO_TENANT_ID);
  const sourceIds = new Set(sources.map(source => source.id));
  const missing = [...new Set(fixtures.flatMap(item => item.required_source_ids))].filter(id => !sourceIds.has(id));
  if (missing.length) throw new Error('Evaluation corpus coverage incomplete.');
  const config = getAIConfig();
  const results: {
    id: string; question: string; expected: string; timestamp: string; latencyMs: number; requiredSourceIds: string[];
    citedSourceIds: string[]; missingRequiredIds: string[]; literalCitationsValid: boolean; factCoverage: boolean;
    automatedPassed: boolean; humanReview: 'pending'; response?: AskResponse; error?: string; errorStatus?: number;
  }[] = [];
  await mkdir('.data', { recursive: true });
  for (const fixture of fixtures) {
    const started = Date.now();
    const base = { id: fixture.id, question: fixture.question, expected: fixture.expected, timestamp: new Date().toISOString(),
      requiredSourceIds: fixture.required_source_ids, humanReview: 'pending' as const };
    try {
      const response = await askQuestion(fixture.question, DEMO_TENANT_ID);
      const refs = response.claims.flatMap(claim => claim.evidence);
      const citedSourceIds = [...new Set(refs.map(item => item.sourceId))];
      const missingRequiredIds = fixture.required_source_ids.filter(id => !citedSourceIds.includes(id));
      const literalCitationsValid = refs.every(ref => sources.find(source => source.id === ref.sourceId)?.content.includes(ref.excerpt));
      const factCoverage = !fixture.facts || [fixture.facts.original_target, fixture.facts.qa_forecast, fixture.facts.security.toLowerCase()]
        .every(fact => response.answer.toLowerCase().includes(fact));
      const expectedStatus = fixture.required_source_ids.length ? 'supported' : 'insufficient_evidence';
      const automatedPassed = response.status === expectedStatus && !missingRequiredIds.length && literalCitationsValid && factCoverage;
      results.push({ ...base, latencyMs: Date.now() - started, citedSourceIds, missingRequiredIds, literalCitationsValid, factCoverage, automatedPassed, response });
    } catch (error: unknown) {
      const errorStatus = error instanceof Error && 'status' in error && typeof error.status === 'number' && Number.isInteger(error.status) ? error.status : undefined;
      results.push({ ...base, latencyMs: Date.now() - started, citedSourceIds: [], missingRequiredIds: fixture.required_source_ids,
        literalCitationsValid: false, factCoverage: false, automatedPassed: false, errorStatus,
        error: error instanceof ApiError ? error.message : 'Live service/model request failed; no model pass claimed.' });
    }
    const latencies = results.map(item => item.latencyMs).sort((a, b) => a - b);
    const mid = Math.floor(latencies.length / 2);
    const medianLatencyMs = latencies.length % 2 ? latencies[mid] : (latencies[mid - 1] + latencies[mid]) / 2;
    const report = { timestamp: new Date().toISOString(), model: config.model, location: config.location,
      embeddingModel: config.embeddingModel, embeddingLocation: config.embeddingLocation, dimensions: 768,
      settings: { generationOutputTokens: 4096, semanticOutputTokens: 8192, thinking: 'LOW for gemini-3.8-flash', maxContextChunks: 12 },
      corpusSourceCount: sources.length, suiteFixtures: allFixtures.length, runScope: selectedId ? 'selected-case-retry' : 'full-suite', totalFixtures: fixtures.length, completed: results.length,
      automatedPassed: results.filter(item => item.automatedPassed).length, automatedFailed: results.filter(item => !item.automatedPassed).length,
      humanReviewed: 0, humanSemanticPasses: null, medianLatencyMs, results };
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    const last = results[results.length - 1];
    console.log(JSON.stringify({ id: last.id, automatedPassed: last.automatedPassed, missingRequiredIds: last.missingRequiredIds, latencyMs: last.latencyMs, error: last.error }));
    // Shared embedding quota is five starts/minute; do not burst queries after fast abstentions/errors.
    const wait = 15_000 - (Date.now() - started);
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  }
  console.log(JSON.stringify({ completed: results.length, automatedPassed: results.filter(item => item.automatedPassed).length,
    automatedFailed: results.filter(item => !item.automatedPassed).length, humanReviewed: 0, report: reportPath }));
  if (results.some(item => !item.automatedPassed)) process.exitCode = 1;
}
main().catch(() => { console.error('Live evaluation unavailable or corpus incomplete. No benchmark pass claimed.'); process.exitCode = 1; });
