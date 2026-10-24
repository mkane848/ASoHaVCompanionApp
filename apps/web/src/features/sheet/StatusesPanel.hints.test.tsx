// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render as plainRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { normalizeSheet, seedLibrary, type CharacterSheet } from '@asohav/shared';
import { StatusesPanel } from './StatusesPanel.js';
import { AidTagMenu } from '../roll/AidTagMenu.js';

afterEach(cleanup);

// Some descendants (ArmorSection's glossary matcher) read the library through TanStack Query.
const render = (ui: ReactElement) => plainRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

function describedText(button: HTMLElement) {
  const id = button.getAttribute('aria-describedby');
  return id ? document.getElementById(id)?.textContent : undefined;
}

describe('StatusesPanel Recuperate reason', () => {
  const sheet = (dying: boolean) => normalizeSheet({ Dying: dying, Virtues: [], Statuses: [], Armor: [] } as unknown as CharacterSheet);

  it('shows why Recuperate is disabled for a Dying Hero', () => {
    render(<StatusesPanel sheet={sheet(true)} library={seedLibrary()} commit={() => {}} />);
    const btn = screen.getByRole('button', { name: /Recuperate/ });
    expect(btn).toHaveProperty('disabled', true);
    expect(describedText(btn)).toBe('A Dying Hero can’t take Recuperate.');
    expect(btn.hasAttribute('title')).toBe(false);
  });

  it('has no such hint for a Hero who is not Dying', () => {
    render(<StatusesPanel sheet={sheet(false)} library={seedLibrary()} commit={() => {}} />);
    expect(screen.getByRole('button', { name: /Recuperate/ }).hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('AidTagMenu with no unused tags', () => {
  it('shows why Aid is disabled', () => {
    render(<AidTagMenu tags={[]} onAid={() => {}} />);
    const btn = screen.getByRole('button', { name: /Aid/ });
    expect(btn).toHaveProperty('disabled', true);
    expect(describedText(btn)).toMatch(/^No unused Party Skill Tags/);
  });
});
