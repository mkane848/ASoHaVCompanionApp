// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { Library } from '@asohav/shared';
import { AddParticipantModal } from './AddParticipantModal.js';

afterEach(cleanup);

function setup() {
  const library = { enemies: [], villains: [], npcs: [], settings: {} } as unknown as Library;
  render(<AddParticipantModal library={library} availableCharacters={[]} heroCount={0} enemyThreats={[]} onAddPC={vi.fn()} onAddEnemy={vi.fn()} onClose={vi.fn()} />);
  return screen.getAllByRole('tab');
}

describe('AddParticipantModal tablist', () => {
  it('uses a roving tabindex: only the selected tab is in the tab order', () => {
    const tabs = setup();
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1', '-1']); // Enemies is first with no heroes
  });

  it('moves selection and focus with Arrow, Home and End keys', () => {
    const tabs = setup();
    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' });
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[2]);
    fireEvent.keyDown(tabs[2], { key: 'End' });
    expect(tabs[4].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tabs[4], { key: 'ArrowRight' });
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
    expect(tabs[4].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tabs[4], { key: 'Home' });
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });
});
