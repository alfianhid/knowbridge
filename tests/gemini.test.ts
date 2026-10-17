import { afterEach, describe, expect, it, vi } from 'vitest';
import { assessSemantics, embed, generateDecisionBrief, generateGrounded, getAIConfig, validateEmbedding } from '../src/lib/gemini';
import { loadSyntheticSources } from '../src/lib/sources';

const { embedContent, generateContent, construct } = vi.hoisted(() => ({ embedContent: vi.fn(), generateContent: vi.fn(), construct: vi.fn() }));
vi.mock('@google/genai', () => ({ ThinkingLevel: { LOW: 'LOW' }, GoogleGenAI: class {
  constructor(options: unknown) { construct(options); }
  models = { embedContent, generateContent };
} }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function configure() {
  for (const [name, value] of Object.entries({ GOOGLE_CLOUD_PROJECT: 'knowbridge-demo', GOOGLE_CLOUD_LOCATION: 'global',
    GEMINI_MODEL: 'gemini-3-flash-preview', EMBEDDING_MODEL: 'gemini-embedding-001', EMBEDDING_DIMENSIONS: '768',
    GOOGLE_GENAI_USE_VERTEXAI: 'true' })) vi.stubEnv(name, value);
}

describe('Vertex AI embedding boundary', () => {
  it('requests complete primary evidence and literal readiness values before the first brief attempt', async () => {
    configure();
    const chunks = (await loadSyntheticSources())[0].chunks;
    generateContent.mockResolvedValue({ text: '{"status":"at_risk"}' });
    await generateDecisionBrief('Can Project Harbour launch on 1 Nov?', chunks);
    const sent = generateContent.mock.calls[0][0];
    expect(JSON.parse(sent.contents)).toMatchObject({ evidence: chunks });
    expect(sent.config.responseJsonSchema.properties).toHaveProperty('supportingClaims');
    expect(sent.config.systemInstruction).toContain('including the Risk Register and Decision Log');
    expect(sent.config.systemInstruction).toContain('Available context alone is not a citation');
    expect(sent.config.systemInstruction).toContain("supported only by that conflict's left and right excerpts");
    expect(sent.config.systemInstruction).toContain('Cite proposal identifiers and their terms in supportingClaims');
    expect(sent.config.systemInstruction).toContain('exact ISO dates');
    expect(sent.config.systemInstruction).toContain('literal security approval status');
    expect(sent.config.systemInstruction).toContain('does not prove launch impossible or unviable');
    expect(sent.config.systemInstruction).toContain('in supportingClaims claim text');
    expect(sent.config.systemInstruction).toContain('A proposed date does not ensure QA completion, security approval or policy compliance');
  });
  it('requests separate structured semantic review with source context and authority rules', async () => {
    configure();
    const context = (await loadSyntheticSources())[0].chunks;
    const statements = [{ text: 'No signed revised commitment is evidenced.', evidence: [{ sourceId: 'HBR-DOC-09', excerpt: 'Example literal evidence.' }] }];
    generateContent.mockResolvedValue({ text: '{"statements":[]}' });
    expect(await assessSemantics(statements, context)).toEqual({ statements: [] });
    const sent = generateContent.mock.calls[0][0];
    expect(JSON.parse(sent.contents)).toMatchObject({ statements, context });
    expect(sent.config.systemInstruction).toContain('Evaluate negation in context');
    expect(sent.config.systemInstruction).toContain('QA forecast predicts completion and is not QA completion');
    expect(sent.config.responseJsonSchema.properties).toHaveProperty('statements');
    await expect(assessSemantics([], context)).rejects.toThrow('requires statements');
  });
  it('rejects missing or incompatible settings', () => {
    configure();
    vi.stubEnv('EMBEDDING_DIMENSIONS', '3072');
    expect(() => getAIConfig()).toThrow('configuration');
  });
  it('requests 768 retrieval dimensions without silent truncation', async () => {
    configure();
    embedContent.mockResolvedValue({ embeddings: [{ values: Array(768).fill(1) }] });
    const vector = await embed('source content', 'RETRIEVAL_DOCUMENT');
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ httpOptions: { apiVersion: 'v1', timeout: 30_000 } }));
    expect(embedContent).toHaveBeenCalledWith({ model: 'gemini-embedding-001', contents: 'source content',
      config: { taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: 768, autoTruncate: false } });
    expect(Math.hypot(...vector)).toBeCloseTo(1);
  });
  it('rejects wrong-sized, nonfinite and zero embeddings', () => {
    for (const vector of [[], Array(768).fill(0), Array(768).fill(Number.NaN), Array(768).fill(Infinity)]) {
      expect(() => validateEmbedding(vector)).toThrow();
    }
  });
  it('sends structured evidence-only requests and preserves invalid JSON for validation retry', async () => {
    configure();
    const chunks = (await loadSyntheticSources())[0].chunks;
    generateContent.mockResolvedValueOnce({ text: '{"status":"insufficient_evidence","claims":[],"unknowns":["Missing evidence"]}' });
    expect(await generateGrounded('Can Harbour launch?', chunks)).toMatchObject({ status: 'insufficient_evidence' });
    const sent = generateContent.mock.calls[0][0];
    expect(sent.model).toBe('gemini-3-flash-preview');
    expect(sent.config.responseMimeType).toBe('application/json');
    expect(sent.config.responseJsonSchema.properties).toHaveProperty('claims');
    expect(sent.config.responseJsonSchema).not.toHaveProperty('$schema');
    expect(sent.config.responseJsonSchema.properties.claims.items.properties.claim).not.toHaveProperty('minLength');
    expect(sent.config.systemInstruction).toContain('baseline versus forecast versus commitment versus approved decision');
    expect(sent.config.systemInstruction).toContain('it NEVER means a launch or decision is approved');
    expect(JSON.parse(sent.contents).evidence).toEqual(chunks);
    expect(JSON.parse(sent.contents).asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sent.config.systemInstruction).toContain('Historical plans do not prove an event happened');
    generateContent.mockResolvedValueOnce({ text: 'invalid JSON' });
    expect(await generateGrounded('Can Harbour launch?', chunks, 'Retry with valid citations')).toBe('invalid JSON');
    expect(JSON.parse(generateContent.mock.calls[1][0].contents).validationFeedback).toBe('Retry with valid citations');
    await expect(generateGrounded('Question?', [])).rejects.toThrow('without evidence');
  });
  it('omits unsupported temperature for Gemini 3.8 Flash', async () => {
    configure();
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.8-flash');
    generateContent.mockResolvedValue({ text: '{"status":"insufficient_evidence","claims":[],"unknowns":["Missing evidence"]}' });
    await generateGrounded('Can Harbour launch?', (await loadSyntheticSources())[0].chunks);
    expect(generateContent.mock.calls[0][0].model).toBe('gemini-3.8-flash');
    expect(generateContent.mock.calls[0][0].config).not.toHaveProperty('temperature');
    expect(generateContent.mock.calls[0][0].config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ httpOptions: { apiVersion: 'v1', timeout: 60_000 } }));
  });
});
