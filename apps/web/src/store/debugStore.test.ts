import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDebug, saveDebug } from './debugStore.js';

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const mock = {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn((k: string) => void store.delete(k)),
  };
  vi.stubGlobal('localStorage', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadDebug / saveDebug', () => {
  it('is off with nothing stored', () => {
    stubLocalStorage();
    expect(loadDebug()).toBe(false);
  });

  it('round-trips on and off', () => {
    const mock = stubLocalStorage();
    saveDebug(true);
    expect(loadDebug()).toBe(true);
    saveDebug(false);
    expect(mock.removeItem).toHaveBeenCalledWith('asohav.debug');
    expect(loadDebug()).toBe(false);
  });

  it('fails closed when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadDebug()).toBe(false);
    expect(() => saveDebug(true)).not.toThrow();
  });
});
