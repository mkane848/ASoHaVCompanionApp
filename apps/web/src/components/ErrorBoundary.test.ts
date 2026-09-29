import { describe, expect, it } from 'vitest';
import { CHUNK_RELOAD_KEY, CHUNK_RELOAD_WINDOW_MS, claimChunkReload, isChunkLoadError } from './ErrorBoundary.js';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('isChunkLoadError', () => {
  it.each([
    ['Chrome', 'Failed to fetch dynamically imported module: https://x.test/assets/AdventuresPage-abc.js'],
    ['Safari', 'Importing a module script failed.'],
    ['Firefox', 'error loading dynamically imported module: https://x.test/assets/AdventuresPage-abc.js'],
    ['a stale asset answered with index.html', "'text/html' is not a valid JavaScript MIME type."],
    ["Vite's CSS preload", 'Unable to preload CSS for /assets/AdventuresPage-abc.css'],
  ])('recognises %s', (_engine, message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it('leaves an ordinary render error alone', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError({ message: 'Importing a module script failed.' })).toBe(false);
  });
});

describe('claimChunkReload', () => {
  const now = 1_800_000_000_000;

  it('allows the first reload and stamps it', () => {
    const storage = memoryStorage();
    expect(claimChunkReload(storage, now)).toBe(true);
    expect(storage.data.get(CHUNK_RELOAD_KEY)).toBe(String(now));
  });

  it('refuses a second reload inside the window — the loop guard', () => {
    const storage = memoryStorage({ [CHUNK_RELOAD_KEY]: String(now - CHUNK_RELOAD_WINDOW_MS + 1) });
    expect(claimChunkReload(storage, now)).toBe(false);
  });

  it('allows another once the window has passed', () => {
    const storage = memoryStorage({ [CHUNK_RELOAD_KEY]: String(now - CHUNK_RELOAD_WINDOW_MS) });
    expect(claimChunkReload(storage, now)).toBe(true);
  });

  it('is not stuck by a stamp from a clock that has since moved backwards', () => {
    const storage = memoryStorage({ [CHUNK_RELOAD_KEY]: String(now + 60 * 60_000) });
    expect(claimChunkReload(storage, now)).toBe(true);
  });

  it('treats a garbage stamp as no stamp', () => {
    expect(claimChunkReload(memoryStorage({ [CHUNK_RELOAD_KEY]: 'nope' }), now)).toBe(true);
  });

  it('never reloads when the guard cannot be recorded', () => {
    expect(claimChunkReload(null, now)).toBe(false);
    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      },
    };
    expect(claimChunkReload(throwing, now)).toBe(false);
  });
});
