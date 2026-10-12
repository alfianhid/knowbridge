import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SourceExplorer } from '../src/components/source-explorer';

describe('source explorer', () => {
  it('exposes synthetic disclosure and selected-source state accessibly', () => {
    const html = renderToStaticMarkup(<SourceExplorer sources={[{
      id: 'HBR-DOC-02',
      title: 'Project Harbour — Customer Commitments',
      kind: 'google_doc',
      project: 'HBR',
      recordedAt: '2026-10-07',
      sourceUrl: '/api/sources/HBR-DOC-02',
      chunkCount: 1,
    }]} />);

    expect(html).toContain('Fictional synthetic records only');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-controls="source-details"');
    expect(html).toContain('<li>');
  });
});
