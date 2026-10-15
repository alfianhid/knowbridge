import { mkdir, writeFile } from 'node:fs/promises';
import { assessSemantics, getAIConfig } from '../src/lib/gemini';
import { SemanticAssessmentSchema, type SemanticStatement } from '../src/lib/decision-semantics';
import { evidencePassages } from '../src/lib/retrieval';
import { SyntheticSeedAdapter } from '../src/lib/sources';

async function main(): Promise<void> {
  const sources = await new SyntheticSeedAdapter().list();
  const evidence = (ids: string[]) => ids.map(sourceId => {
    const source = sources.find(source => source.id === sourceId);
    if (!source) throw new Error('Regression source missing.');
    return { sourceId, excerpt: evidencePassages(source.content)[0] };
  });
  const cases = [
    { text: 'Full production launch is definitely impossible.', ids: ['HBR-DOC-02', 'HBR-DOC-04'], supported: false },
    { text: 'The customer never expected delivery on 2026-11-01.', ids: ['HBR-DOC-02'], supported: false },
    { text: 'QA is complete.', ids: ['HBR-DOC-04'], supported: false },
    { text: 'Security has approved production launch.', ids: ['HBR-DOC-06'], supported: false },
    { text: 'The client signed a revised full-release commitment and approved the pilot.', ids: ['HBR-DOC-09', 'HBR-DOC-15'], supported: false },
    { text: 'The target is an expectation rather than an approved or feasible commitment.', ids: ['HBR-DOC-02', 'HBR-DOC-04', 'HBR-DOC-09'], supported: false },
    { text: 'No signed revised commitment is evidenced in the decision log.', ids: ['HBR-DOC-09'], supported: true },
    { text: 'The client target remains 2026-11-01; QA forecasts final regression completion on 2026-11-11. Security production approval is pending. Do not confirm a revised release commitment without customer approval.', ids: ['HBR-DOC-02', 'HBR-DOC-04', 'HBR-DOC-06', 'HBR-DOC-09'], supported: true },
  ];
  const statements: SemanticStatement[] = cases.map(item => ({ text: item.text, evidence: evidence(item.ids) }));
  const ids = new Set(cases.flatMap(item => item.ids));
  const context = sources.filter(source => ids.has(source.id)).flatMap(source => source.chunks);
  const started = Date.now();
  const assessment = SemanticAssessmentSchema.parse(await assessSemantics(statements, context));
  const results = cases.map((item, index) => {
    const matches = assessment.statements.filter(result => result.index === index);
    const actual = matches[0];
    return { ...item, assessment: actual, passed: matches.length === 1 && (actual.verdict === 'supported') === item.supported };
  });
  const report = { timestamp: new Date().toISOString(), model: getAIConfig().model, location: getAIConfig().location,
    latencyMs: Date.now() - started, passed: results.filter(item => item.passed).length, total: cases.length,
    review: 'automated live semantic regressions; human review still required', statements, results };
  await mkdir('.data', { recursive: true });
  await writeFile('.data/semantic-regressions.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, statements: undefined, results: results.map(({ text, passed, assessment }) => ({ text, passed, verdict: assessment?.verdict })) }));
  if (report.passed !== report.total) process.exitCode = 1;
}
main().catch(() => { console.error('Live semantic regression failed. No semantic pass is claimed.'); process.exitCode = 1; });
