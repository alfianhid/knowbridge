// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AskPanel } from '../src/components/ask-panel';
import { DecisionBriefPanel } from '../src/components/decision-brief-panel';
import { WorkspacePanel } from '../src/components/workspace-panel';
import { SAMPLE_QUESTIONS } from '../src/components/sample-questions';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('prefills an editable Ask question and switches scenarios without submitting', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<AskPanel />);
  const input = screen.getByRole('textbox', { name: 'Question' }) as HTMLInputElement;
  expect(input.value).toBe(SAMPLE_QUESTIONS[0].question);
  for (const sample of SAMPLE_QUESTIONS) {
    fireEvent.click(screen.getByRole('button', { name: sample.label }));
    expect(input.value).toBe(sample.question);
  }
  fireEvent.change(input, { target: { value: 'My own question' } });
  expect(input.value).toBe('My own question');
  expect(fetch).not.toHaveBeenCalled();
});

it('prefills brief questions while leaving credentials and review deliberate', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<DecisionBriefPanel />);
  expect((screen.getByLabelText('Decision question') as HTMLInputElement).value).toBe(SAMPLE_QUESTIONS[0].question);
  expect((screen.getByLabelText('Member Firebase ID token') as HTMLInputElement).value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Missing approval' }));
  expect((screen.getByLabelText('Decision question') as HTMLInputElement).value).toBe(SAMPLE_QUESTIONS[2].question);
  expect(screen.queryByRole('button', { name: 'Mark evidence reviewed' })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('keeps Workspace credentials blank and explains the import prerequisites', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<WorkspacePanel enabled configured />);
  expect((screen.getByLabelText('Workspace member Firebase ID token') as HTMLInputElement).value).toBe('');
  expect(screen.getByText(/Harbour samples need Harbour files/)).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
