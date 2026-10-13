import { describe, expect, it } from 'vitest';
import { contextualizeCsv, extractEffectiveDate, ingestSyntheticSources, InMemoryIngestionStore, loadSyntheticSources, splitIntoBodies } from '../src/lib/sources';

describe('source semantics', () => {
  it('preserves quoted CSV values, empty cells, Unicode and multiline fields', () => {
    expect(contextualizeCsv('Name,Notes,Status\r\n"Fictional, Co","A ""quote""\n第二行",\r\n')).toBe('Row 1\nName: Fictional, Co\nNotes: A "quote"\n第二行\nStatus: ');
    expect(() => contextualizeCsv('a,b\n1')).toThrow('Invalid CSV columns');
    expect(() => contextualizeCsv('a,b\n"unfinished,2')).toThrow('Unterminated CSV');
  });
  it.each([599, 600, 601, 1201])('bounds %i-word chunks and retains literal whitespace', count => {
    const text = Array.from({ length: count }, (_, index) => `word${index}`).join('  \t');
    const chunks = splitIntoBodies(text);
    expect(chunks.every(body => text.includes(body) && body.split(/\s+/).length <= 600)).toBe(true);
    expect(chunks.join(' ').split(/\s+/).length).toBe(count);
  });
  it('distinguishes effective dates and rejects impossible calendar dates', () => {
    expect(extractEffectiveDate('Recorded date: 2026-10-11\nEffective date: 2026-10-01')).toBe('2026-10-01');
    expect(extractEffectiveDate('Recorded date: 2026-10-11')).toBeNull();
    expect(() => extractEffectiveDate('Effective date: 2026-02-30')).toThrow();
  });
  it('retains customer expectation, QA forecast, pending approval and unapproved proposal as distinct source facts', async () => {
    const sources = await loadSyntheticSources();
    const content = (id: string) => sources.find(source => source.id === id)!.content;
    expect(content('HBR-DOC-02')).toContain('The client team continues planning around 2026-11-01');
    expect(content('HBR-DOC-04')).toContain('latest forecast for final regression completion is 2026-11-11');
    expect(content('HBR-DOC-06')).toContain('Production release approval: PENDING.');
    expect(content('HBR-DOC-09')).toContain('No decision authorizing a later full-release date exists');
    expect(content('HBR-DOC-15')).toContain('DRAFT / NOT APPROVED');
    expect(sources.find(source => source.id === 'HBR-DOC-04')!.recordedAt).toBe('2026-10-10');
  });
  it('reports partial failures and safely retries only unfinished sources', async () => {
    const memory = new InMemoryIngestionStore();
    let fail = true;
    const store = { get: memory.get.bind(memory), list: memory.list.bind(memory), consumeIngestionQuota: memory.consumeIngestionQuota.bind(memory),
      upsert: async (source: Awaited<ReturnType<typeof loadSyntheticSources>>[number]) => {
        if (fail && source.id === 'HBR-DOC-02') throw new Error('Storage unavailable');
        return memory.upsert(source);
      } };
    const first = await ingestSyntheticSources({ store, sourceIds: ['HBR-DOC-01', 'HBR-DOC-02'] });
    expect(first).toMatchObject({ processed: 1, failed: 1, skipped: 0 });
    fail = false;
    const retry = await ingestSyntheticSources({ store, sourceIds: ['HBR-DOC-02', 'HBR-DOC-01'] });
    expect(retry).toMatchObject({ processed: 1, skipped: 1, failed: 0, jobId: first.jobId });
  });
});
