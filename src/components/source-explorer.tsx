'use client';

import React, { useEffect, useState } from 'react';
import type { SourceSummary } from '@/lib/sources';
import { SourceDetailSchema, type SourceDetail } from '../lib/source-detail';

interface SourceExplorerProps {
  sources: SourceSummary[];
}

export function SourceExplorer({ sources }: SourceExplorerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(sources[0]?.id ?? null);
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    let active = true;
    setDetail(null);
    setError(null);
    fetch(`/api/sources/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Source unavailable');
        const parsed = SourceDetailSchema.parse(await response.json());
        if (parsed.id !== selectedId) throw new Error('Source mismatch');
        return parsed;
      })
      .then(value => { if (active) setDetail(value); })
      .catch((fetchError: unknown) => {
        if (!active || (fetchError instanceof DOMException && fetchError.name === 'AbortError')) return;
        setError('Source unavailable. Select another record or retry.');
      });
    return () => { active = false; controller.abort(); };
  }, [selectedId, requestVersion]);

  if (sources.length === 0) return <p className="empty-state">No synthetic evidence has been imported.</p>;

  return (
    <section className="catalog" aria-labelledby="catalog-title">
      <div className="catalog-list">
        <div className="section-heading">
          <div><p className="eyebrow">IMPORTED EVIDENCE</p><h2 id="catalog-title">Source catalog</h2></div>
          <span className="count">{sources.length} sources</span>
        </div>
        <p className="disclosure">Fictional synthetic records only. No customer data or live Google Drive files.</p>
        <ul className="source-list" aria-label="Imported synthetic sources">
          {sources.map((source) => (
            <li key={source.id}>
              <button
                aria-controls="source-details"
                aria-current={source.id === selectedId ? 'true' : undefined}
                className={source.id === selectedId ? 'source-row selected' : 'source-row'}
                onClick={() => setSelectedId(source.id)}
                type="button"
              >
                <span><strong>{source.title}</strong><small>{source.id} · {source.project}</small></span>
                <span className="kind">{source.kind === 'google_doc' ? 'DOC' : 'SHEET'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{error ? '' : detail ? `Loaded ${detail.title}.` : 'Loading source details.'}</p>
      <aside className="source-detail" id="source-details" aria-busy={!detail && !error} aria-label="Source details">
        {error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRequestVersion((version) => version + 1)}>Retry</button></div> : null}
        {!error && !detail ? <p>Loading source details…</p> : null}
        {detail ? (
          <>
            <p className="eyebrow">SOURCE EVIDENCE</p><h2>{detail.title}</h2>
            <dl>
              <div><dt>Stable ID</dt><dd>{detail.id}</dd></div>
              <div><dt>Project</dt><dd>{detail.project}</dd></div>
              <div><dt>Source recorded date</dt><dd>{detail.recordedAt}</dd></div>
              {detail.effectiveAt ? <div><dt>Effective date</dt><dd>{detail.effectiveAt}</dd></div> : null}
              <div><dt>Owner</dt><dd>{detail.owner}</dd></div>
              <div><dt>Chunks</dt><dd>{detail.chunkCount}</dd></div>
            </dl>
            <p className="date-note">This historical source date is not a Google Drive updated timestamp.</p>
            <div className="evidence-scroll" tabIndex={0} role="region" aria-label={`${detail.title} evidence`}>
              {detail.content.split(/\n\s*\n/).map((block, index) => {
                const [heading, ...body] = block.split('\n');
                return <section key={`${detail.id}:${index}`}>
                  <h3>{heading}</h3><p className="evidence-text">{body.join('\n')}</p>
                </section>;
              })}
            </div>
            <details><summary>Original source text</summary><pre tabIndex={0} role="region" aria-label="Original source text">{detail.content}</pre></details>
          </>
        ) : null}
      </aside>
    </section>
  );
}
