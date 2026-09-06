import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { DEFAULT_APPEARANCE } from '../lib/appearances.js';
import { loadAppearance, saveAppearance, useAppearanceStore } from './appearanceStore.js';

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const mock = {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void store.set(k, v)),
  };
  vi.stubGlobal('localStorage', mock);
  return mock;
}

function stubLocation(search: string) {
  vi.stubGlobal('location', { search });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadAppearance', () => {
  it('defaults to Notice Board when localStorage has nothing and there is no ?appearance= param', () => {
    stubLocalStorage();
    stubLocation('');

    expect(loadAppearance()).toBe(DEFAULT_APPEARANCE);
    expect(loadAppearance()).toBe('noticeboard');
  });

  // 0.39.0 item 1: the storage key rename IS the one-time forced reset — a legacy
  // 'asohav.appearance' value with no '.v2' key yet falls straight through to the new default.
  it('resets a legacy Parchment choice under the old key to Notice Board (the forced default flip)', () => {
    stubLocalStorage({ 'asohav.appearance': 'parchment' });
    stubLocation('');

    expect(loadAppearance()).toBe('noticeboard');
  });

  it('respects a Parchment choice already saved under the new key', () => {
    stubLocalStorage({ 'asohav.appearance.v2': 'parchment' });
    stubLocation('');

    expect(loadAppearance()).toBe('parchment');
  });

  it('reads a previously-saved value from localStorage', () => {
    stubLocalStorage({ 'asohav.appearance.v2': 'parchment' });
    stubLocation('');

    expect(loadAppearance()).toBe('parchment');
  });

  it('ignores a garbage value someone else wrote to the key, falling back to the default', () => {
    stubLocalStorage({ 'asohav.appearance.v2': 'sepia-tone' });
    stubLocation('');

    expect(loadAppearance()).toBe(DEFAULT_APPEARANCE);
  });

  it('prefers ?appearance= over localStorage — the responsive-smoke/screenshot harness forcing an appearance deterministically', () => {
    stubLocalStorage({ 'asohav.appearance.v2': 'noticeboard' });
    stubLocation('?appearance=parchment');

    expect(loadAppearance()).toBe('parchment');
  });

  it('falls through to localStorage when the query param is present but not a valid AppearanceId', () => {
    stubLocalStorage({ 'asohav.appearance.v2': 'parchment' });
    stubLocation('?appearance=sepia-tone');

    expect(loadAppearance()).toBe('parchment');
  });

  it('falls back to the default if localStorage.getItem throws (private mode, disabled storage)', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
    });
    stubLocation('');

    expect(loadAppearance()).toBe(DEFAULT_APPEARANCE);
  });

  it('falls back to the default if `location` itself is unavailable', () => {
    stubLocalStorage({ 'asohav.appearance.v2': 'parchment' });
    vi.stubGlobal('location', undefined);

    expect(loadAppearance()).toBe(DEFAULT_APPEARANCE);
  });
});

describe('saveAppearance', () => {
  it('writes the id under the expected key', () => {
    const mock = stubLocalStorage();

    saveAppearance('parchment');

    expect(mock.setItem).toHaveBeenCalledWith('asohav.appearance.v2', 'parchment');
  });

  it('swallows a write failure rather than throwing', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    });

    expect(() => saveAppearance('noticeboard')).not.toThrow();
  });
});

describe('useAppearanceStore', () => {
  it('setAppearance persists, updates the DOM dataset, and updates state together', () => {
    const mock = stubLocalStorage();
    vi.stubGlobal('document', { documentElement: { dataset: {} as Record<string, string> } });

    useAppearanceStore.getState().setAppearance('parchment');

    expect(mock.setItem).toHaveBeenCalledWith('asohav.appearance.v2', 'parchment');
    expect((document.documentElement.dataset as Record<string, string>).appearance).toBe('parchment');
    expect(useAppearanceStore.getState().appearance).toBe('parchment');
  });
});

// A comment-only sync (index.html's inline no-flash script can't import this module) broke
// silently before — 0.39.0's default flip is exactly the kind of change that could re-break it,
// so this reads the actual shipped file rather than trusting the two stay in sync by convention.
describe('index.html inline script stays in sync with DEFAULT_APPEARANCE', () => {
  it('defaults to the same appearance as appearances.ts', () => {
    const path = fileURLToPath(new URL('../../index.html', import.meta.url));
    const html = readFileSync(path, 'utf-8');
    const match = html.match(/var v = '(\w+)';/);
    expect(match?.[1]).toBe(DEFAULT_APPEARANCE);
  });
});
