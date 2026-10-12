'use client';

import React, { useEffect, useState } from 'react';
import type { SourceRecord, SourceSummary } from '@/lib/sources';

interface SourceExplorerProps {
  sources: SourceSummary[];
}

export function SourceExplorer({ sources }: SourceExplorerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(sources[0]?.id ?? null);
  const [detail, setDetail] = useState<SourceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    fetch(`/api/sources/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Source unavailable');
        return response.json() as Promise<SourceRecord>;
      })
      .then(setDetail)
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setError('Source unavailable. Select another record or retry.');
      });
    return () => controller.abort();
  }, [selectedId, requestVersion]);

  if (sources.length === 0) return <p className="empty-state">No synthetic evidence has been imported.</p>;

  return (
    <section className="catalog" aria-labelledby="catalog-title">
      <div className="catalog-list">
        <div className="section-heading">
          <div><p className="eyebrow">BOUNDED LOCAL IMPORT</p><h2 id="catalog-title">Source catalog</h2></div>
          <span className="count">{sources.length} sources</span>
        </div>
        <p className="disclosure">Fictional synthetic records only. No customer data or live Google Drive files.</p>
        <ul className="source-list" aria-label="Imported synthetic sources">
          {sources.map((source) => (
            <li key={source.id}>
              <button
                aria-controls="source-details"
                aria-pressed={source.id === selectedId}
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
      <aside className="source-detail" id="source-details" aria-live="polite" aria-label="Source details">
        {error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRequestVersion((version) => version + 1)}>Retry</button></div> : null}
        {!error && !detail ? <p role="status">Loading source details…</p> : null}
        {detail ? (
          <>
            <p className="eyebrow">SOURCE EVIDENCE</p><h2>{detail.title}</h2>
            <dl>
              <div><dt>Stable ID</dt><dd>{detail.id}</dd></div>
              <div><dt>Project</dt><dd>{detail.project}</dd></div>
              <div><dt>Source recorded date</dt><dd>{detail.recordedAt}</dd></div>
              <div><dt>Owner</dt><dd>{detail.owner}</dd></div>
              <div><dt>Chunks</dt><dd>{detail.chunkCount}</dd></div>
            </dl>
            <p className="date-note">This historical source date is not a Google Drive updated timestamp.</p>
            <pre>{detail.content}</pre>
          </>
        ) : null}
      </aside>
    </section>
  );
}
