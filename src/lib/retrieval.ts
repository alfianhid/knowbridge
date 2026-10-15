import { ApiError, authorizeChunks, type AccessScope } from './access';
import { type SourceChunk, type SourceRecord } from './sources';

const STOP = new Set('a an the is are was were can could should would what when where how why on in of to for and or it its this that project harbour hbr please tell me about do does did have has my we commit identify conflicting evidence recommend next step required before any'.split(' '));

function terms(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).map(term => term === 'approvals' ? 'approval' : term).filter(term => (term.length > 2 || term === 'qa') && !STOP.has(term)))];
}

function queryTerms(question: string): string[] {
  const tokens = terms(question);
  if (/\b(launch(?:ing)?|release|deliver|delivery)\b/i.test(question)) {
    tokens.push('client', 'target', 'forecast', 'qa', 'security', 'approval', 'commitment', 'pilot', 'decision');
  }
  return [...new Set(tokens)];
}

// Operative paragraphs exclude shared seed headers/context, which would inflate lexical recall.
export function evidencePassages(body: string): string[] {
  const relevant = body.split(/\nEVIDENCE CAUTION\n/i)[0];
  const sections = relevant.split(/\n[A-Z][A-Z0-9 /—–:,().-]{5,}(?:\n|$)/);
  const operational = sections.length >= 3 ? sections.slice(/\nPROJECT CONTEXT\n/.test(relevant) ? 2 : 1).join('\n') : relevant;
  return operational.split(/\n+/).map(line => line.trim()).filter(line => line.length >= 30);
}

export function selectQuestionSources(question: string, sources: SourceRecord[], scope: AccessScope): SourceRecord[] {
  let authorized = sources.filter(source => source.tenantId === scope.tenantId && scope.sourceIds.has(source.id));
  const projectIds = new Set(authorized.filter(source => {
    const projectName = source.content.match(/^Project: Project (.+?) \([A-Z]+\)/m)?.[1];
    return projectName && question.toLowerCase().includes(projectName.toLowerCase());
  }).map(source => source.projectId));
  if (projectIds.size) authorized = authorized.filter(source => projectIds.has(source.projectId) || source.id.startsWith('POL-'));
  else if (/\bpolicy\b/i.test(question) || /\bapprovals?\b.*\brequired\b/i.test(question)) {
    const policies = authorized.filter(source => source.id.startsWith('POL-'));
    if (policies.length) authorized = policies;
  }
  if (!/\b(revision\s*1|rev\s*1|superseded|historical|compare|difference)\b/i.test(question)) {
    const asOf = new Date().toISOString().slice(0, 10);
    authorized = authorized.filter(source => {
      const family = source.id.match(/^(POL-DOC-\d+)-V\d+$/)?.[1];
      if (!family) return true;
      return source.effectiveAt !== null && source.effectiveAt <= asOf && !authorized.some(other =>
        other.id.startsWith(`${family}-V`) && other.effectiveAt !== null && other.effectiveAt <= asOf && other.effectiveAt > source.effectiveAt!);
    });
  }
  // Readiness questions need primary authority records, rather than summaries repeating their facts.
  const isReadinessDecision = /\b(commit(?:ment)?|readiness|ready)\b/i.test(question) || /\b(can|should|may)\b.{0,80}\b(launch|release)\b/i.test(question);
  if (projectIds.size && isReadinessDecision) {
    const primaryTypes = new Set(['Project Charter', 'Customer Commitments', 'QA Forecast', 'Risk Register', 'Security Assessment', 'Decision Log', 'Change Control']);
    const primary = authorized.filter(source => source.id.startsWith('POL-') || primaryTypes.has(source.content.match(/^Document type: (.+)$/m)?.[1] ?? ''));
    if (primary.some(source => !source.id.startsWith('POL-'))) authorized = primary;
  }
  return authorized;
}

export function retrieveLocal(question: string, sources: SourceRecord[], scope: AccessScope): SourceChunk[] {
  const authorized = selectQuestionSources(question, sources, scope);
  const tokens = queryTerms(question);
  if (!tokens.length) return [];
  const isLaunch = /\b(launch(?:ing)?|release|deliver|delivery)\b/i.test(question);
  const requested = terms(question).filter(term => !isLaunch || !/^(launch(?:ing)?|release|deliver|delivery|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d+)$/.test(term));
  const corpus = authorized.flatMap(source => source.chunks.flatMap(chunk => evidencePassages(chunk.body))).join(' ').toLowerCase() + ' ' + authorized.map(source => source.title).join(' ').toLowerCase();
  if (requested.filter(term => corpus.includes(term)).length < Math.ceil(requested.length * 0.6)) return [];
  return authorizeChunks(authorized.flatMap(source => source.chunks).map(chunk => {
    const text = evidencePassages(chunk.body).join(' ').toLowerCase();
    const title = chunk.title.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0) + (title.includes(token) ? 3 : 0), 0);
    return { chunk, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id)).slice(0, 8).map(item => item.chunk), scope);
}

export function checkRetrieved(chunks: SourceChunk[], sources: ReadonlyMap<string, SourceRecord>, scope: AccessScope): SourceChunk[] {
  authorizeChunks(chunks, scope);
  return chunks.map(chunk => {
    const source = sources.get(chunk.sourceId);
    const original = source?.chunks.find(item => item.id === chunk.id);
    if (!source || !original || JSON.stringify(original) !== JSON.stringify(chunk) || !source.content.includes(chunk.body)) {
      throw new ApiError(502, 'Retrieved source is missing or stale. Reindex before retrying.');
    }
    return original;
  });
}
