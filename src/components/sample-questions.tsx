'use client';

import React from 'react';

export const SAMPLE_QUESTIONS = [
  { label: 'Launch readiness', question: 'Can we commit to launching Project Harbour on 2026-11-01? Identify conflicting evidence and recommend a next step.' },
  { label: 'Timeline conflict', question: 'For Project Harbour, compare the original client target with the latest QA forecast. Does the newer forecast replace the customer commitment?' },
  { label: 'Missing approval', question: 'Has the customer approved a limited pilot for Project Harbour?' },
  { label: 'Current policy', question: 'Which revision of the Launch Readiness policy is effective, and what approvals does it require?' },
  { label: 'Absent evidence', question: 'What is the personal mobile number of the CEO?' },
] as const;

interface SampleQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
  label: string;
}

export function SampleQuestions({ onSelect, disabled, label }: SampleQuestionsProps) {
  return <div className="sample-questions" role="group" aria-label={label}>
    <p className="disclosure">Try a fictional demo scenario. Selecting one fills the question; submit when ready.</p>
    <div className="sample-question-buttons">
      {SAMPLE_QUESTIONS.map(sample => <button type="button" key={sample.label} disabled={disabled}
        onClick={() => onSelect(sample.question)}>{sample.label}</button>)}
    </div>
  </div>;
}
