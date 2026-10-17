'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { SAMPLE_QUESTIONS, SampleQuestions } from './sample-questions';

const AnswerSchema = z.object({
  status: z.enum(['supported', 'insufficient_evidence']),
  answer: z.string(),
  claims: z.array(z.object({
    claim: z.string(),
    evidence: z.array(z.object({
      sourceId: z.string(), excerpt: z.string(), sourceTitle: z.string(),
      sourceUrl: z.string().regex(/^\/api\/sources\/[A-Za-z0-9_-]+$/),
      recordedAt: z.string(), effectiveAt: z.string().nullable(),
    })),
  })),
  unknowns: z.array(z.string()), mode: z.enum(['local', 'vertex']),
  model: z.string().nullable(), synthetic: z.literal(true),
});

export function AskPanel() {
  const [question, setQuestion] = useState<string>(SAMPLE_QUESTIONS[0].question);
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<z.infer<typeof AnswerSchema> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !question.trim()) return;
    if (question.trim().length < 4) {
      setAnswer(null);
      setError('Enter a question with at least 4 characters.');
      return;
    }
    setPending(true);
    setAnswer(null);
    setError(null);
    try {
      const response = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      if (!response.ok) throw new Error('Ask unavailable');
      setAnswer(AnswerSchema.parse(await response.json()));
    } catch {
      setError('Answer unavailable. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="ask-panel" aria-labelledby="ask-title">
      <h2 id="ask-title">Ask about the evidence</h2>
      <p className="disclosure">Fictional synthetic records only. Verify high-impact recommendations with a human.</p>
      <SampleQuestions label="Ask sample questions" onSelect={setQuestion} disabled={pending} />
      <form onSubmit={ask}>
        <label htmlFor="ask-question">Question</label>{' '}
        <textarea id="ask-question" rows={3} value={question} minLength={4} maxLength={2000} required disabled={pending}
          onChange={event => setQuestion(event.target.value)} />{' '}
        <button type="submit" disabled={pending || !question.trim()}>Ask</button>
      </form>
      <p role="status" aria-live="polite">{pending ? 'Searching authorized evidence…' : answer ? 'Answer ready.' : ''}</p>
      {error ? <p role="alert">{error}</p> : null}
      {answer ? (
        <div role="region" aria-label="Grounded answer">
          <p className="disclosure">{answer.mode === 'local'
            ? 'Local deterministic evidence lookup; no AI synthesis.'
            : `Gemini synthesis from retrieved evidence${answer.model ? ` · ${answer.model}` : ''}.`}</p>
          <h3>{answer.status === 'insufficient_evidence' ? 'Insufficient evidence' : 'Evidence-backed answer'}</h3>
          <p>{answer.answer}</p>
          {answer.claims.map((claim, index) => (
            <section key={index} aria-label={`Claim ${index + 1}`}>
              <h4>{claim.claim}</h4>
              {claim.evidence.map((evidence, evidenceIndex) => (
                <figure key={`${evidence.sourceId}:${evidenceIndex}`}>
                  <blockquote className="evidence-text">{evidence.excerpt}</blockquote>
                  <figcaption>
                    <a href={evidence.sourceUrl}>{evidence.sourceTitle} ({evidence.sourceId})</a>
                    <p>Source recorded date: {evidence.recordedAt}. Effective date: {evidence.effectiveAt ?? 'Not specified'}.</p>
                  </figcaption>
                </figure>
              ))}
            </section>
          ))}
          {answer.claims.length > 0 ? <p className="date-note">Source recorded dates are historical source dates, not Google Drive updated timestamps.</p> : null}
          {answer.unknowns.length > 0 ? <><h4>Unknowns</h4><ul>{answer.unknowns.map((unknown, index) => <li key={index}>{unknown}</li>)}</ul></> : null}
        </div>
      ) : null}
    </section>
  );
}
