// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { DemoFlow, SectionNav } from '../src/components/demo-flow';

type ObserverEntry = { target: Element; isIntersecting: boolean };
type ObserverCallback = (entries: ObserverEntry[]) => void;

const observers: Array<{ callback: ObserverCallback; elements: Set<Element> }> = [];

class MockIntersectionObserver {
  elements = new Set<Element>();
  callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }
  observe(element: Element) { this.elements.add(element); }
  unobserve(element: Element) { this.elements.delete(element); }
  disconnect() { this.elements.clear(); }
}

function fireSection(id: string) {
  for (const observer of observers) {
    const entries = [...observer.elements].map((target) => ({
      target, isIntersecting: (target as HTMLElement).id === id,
    }));
    act(() => { observer.callback(entries); });
  }
}

function renderPage() {
  return render(<>
    <SectionNav />
    <DemoFlow />
    <section id="ask" />
    <section id="judge-signin" />
    <section id="brief" />
    <section id="workspace" />
    <section id="sources" />
  </>);
}

beforeEach(() => { observers.length = 0; vi.stubGlobal('IntersectionObserver', MockIntersectionObserver); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Demo flow guide', () => {
  it('lists the five steps in journey order with matching anchors', () => {
    render(<DemoFlow />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#ask', '#judge-signin', '#brief', '#workspace', '#sources']);
    expect(links.map((link) => link.querySelector('.flow-num')?.textContent)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('states the walkthrough promises without claiming approval', () => {
    render(<DemoFlow />);
    expect(screen.getByText(/Review is not an approval/)).toBeTruthy();
    expect(screen.getByText(/Imported evidence never reaches public search/)).toBeTruthy();
    expect(screen.getByText(/absent-evidence question should abstain/)).toBeTruthy();
    expect(screen.getByText('How this demo runs.')).toBeTruthy();
  });

  it('keeps hero nav labels unchanged and hides step numbers from assistive tech', () => {
    render(<SectionNav />);
    const nav = screen.getByRole('navigation', { name: 'Page sections' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#ask', '#judge-signin', '#brief', '#workspace', '#sources']);
    within(nav).getByRole('link', { name: 'Ask' });
    within(nav).getByRole('link', { name: 'Judge sign-in' });
    within(nav).getByRole('link', { name: 'Decision brief' });
    within(nav).getByRole('link', { name: 'Workspace' });
    within(nav).getByRole('link', { name: 'Sources' });
  });

  it('marks the step in view on the nav and in the guide', () => {
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Page sections' });
    const guide = screen.getByRole('region', { name: 'How this demo runs.' });
    fireSection('brief');
    expect(within(nav).getByRole('link', { name: 'Decision brief' }).getAttribute('aria-current')).toBe('location');
    expect(within(guide).getByRole('link', { name: /Decision brief/ }).getAttribute('aria-current')).toBe('step');
    fireSection('sources');
    expect(within(nav).getByRole('link', { name: 'Decision brief' }).getAttribute('aria-current')).toBe(null);
    expect(within(guide).getByRole('link', { name: /Sources/ }).getAttribute('aria-current')).toBe('step');
    expect(within(guide).getByRole('link', { name: /Sources/ }).closest('li')?.className).toBe('flow-row is-active');
  });
});
