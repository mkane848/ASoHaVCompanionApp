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
  it('defaults to Parchment when localStorage has nothing and there is no ?appearance= param', () => {
    stubLocalStorage();
    stubLocation('');

    expect(loadAppearance()).toBe(DEFAULT_APPEARANCE);
  });

  it('reads a previously-saved value from localStorage', () => {
    stubLocalStorage({ 'asohav.appearance': 'noticeboard' });
    stubLocation('');

    expect(loadAppearance()).toBe('noticeboard');
  });

  it('ignores a garbage value someone else wrote to the key, falling back to the default', () => {
    stubLocalStorage({ 'asohav.appearance': 'sepia-tone' });
    stubLocation('');

    expect(loadAppearance()).toBe(DEFAULT_APPEARANCE);
  });

  it('prefers ?appearance= over localStorage — the responsive-smoke/screenshot harness forcing an appearance deterministically', () => {
    stubLocalStorage({ 'asohav.appearance': 'parchment' });
    stubLocation('?appearance=noticeboard');

    expect(loadAppearance()).toBe('noticeboard');
  });

  it('falls through to localStorage when the query param is present but not a valid AppearanceId', () => {
    stubLocalStorage({ 'asohav.appearance': 'noticeboard' });
    stubLocation('?appearance=sepia-tone');

    expect(loadAppearance()).toBe('noticeboard');
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
    stubLocalStorage({ 'asohav.appearance': 'noticeboard' });
    vi.stubGlobal('location', undefined);

    expect(loadAppearance()).toBe(DEFAULT_APPEARANCE);
  });
});

describe('saveAppearance', () => {
  it('writes the id under the expected key', () => {
    const mock = stubLocalStorage();

    saveAppearance('noticeboard');

    expect(mock.setItem).toHaveBeenCalledWith('asohav.appearance', 'noticeboard');
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

    useAppearanceStore.getState().setAppearance('noticeboard');

    expect(mock.setItem).toHaveBeenCalledWith('asohav.appearance', 'noticeboard');
    expect((document.documentElement.dataset as Record<string, string>).appearance).toBe('noticeboard');
    expect(useAppearanceStore.getState().appearance).toBe('noticeboard');
  });
});
