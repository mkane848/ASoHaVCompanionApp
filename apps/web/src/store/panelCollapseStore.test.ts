import { describe, expect, it, afterEach, vi } from 'vitest';
import { load, save, usePanelCollapseStore } from './panelCollapseStore.js';

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const mock = {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void store.set(k, v)),
  };
  vi.stubGlobal('localStorage', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('load', () => {
  it('starts empty ("everything open") when localStorage has nothing', () => {
    stubLocalStorage();

    expect(load()).toEqual({});
  });

  it('parses a previously-saved collapse map', () => {
    stubLocalStorage({ 'asohav.collapsedPanels': JSON.stringify({ virtues: true }) });

    expect(load()).toEqual({ virtues: true });
  });

  it('falls back to empty on malformed JSON rather than throwing', () => {
    stubLocalStorage({ 'asohav.collapsedPanels': '{not json' });

    expect(load()).toEqual({});
  });

  it('falls back to empty if localStorage.getItem throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
    });

    expect(load()).toEqual({});
  });
});

describe('save', () => {
  it('writes the collapse map as JSON under the expected key', () => {
    const mock = stubLocalStorage();

    save({ statuses: true });

    expect(mock.setItem).toHaveBeenCalledWith('asohav.collapsedPanels', JSON.stringify({ statuses: true }));
  });

  it('swallows a write failure rather than throwing', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    });

    expect(() => save({ statuses: true })).not.toThrow();
  });
});

describe('usePanelCollapseStore', () => {
  it('toggle flips exactly the given panel and persists', () => {
    const mock = stubLocalStorage();
    usePanelCollapseStore.setState({ collapsed: { virtues: false } });

    usePanelCollapseStore.getState().toggle('virtues');

    expect(usePanelCollapseStore.getState().collapsed).toEqual({ virtues: true });
    expect(mock.setItem).toHaveBeenCalledWith('asohav.collapsedPanels', JSON.stringify({ virtues: true }));
  });

  it('toggle on an unseen id treats it as currently open (false) and flips it to collapsed', () => {
    stubLocalStorage();
    usePanelCollapseStore.setState({ collapsed: {} });

    usePanelCollapseStore.getState().toggle('load');

    expect(usePanelCollapseStore.getState().collapsed).toEqual({ load: true });
  });

  it('setAll applies one value across every given id without disturbing ids left out', () => {
    stubLocalStorage();
    usePanelCollapseStore.setState({ collapsed: { virtues: true } });

    usePanelCollapseStore.getState().setAll(['statuses', 'load'], true);

    expect(usePanelCollapseStore.getState().collapsed).toEqual({ virtues: true, statuses: true, load: true });
  });
});
