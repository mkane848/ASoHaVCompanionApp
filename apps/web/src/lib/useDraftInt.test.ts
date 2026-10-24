import { describe, expect, it } from 'vitest';
import { parseDraftInt } from './useDraftInt.js';
import { nextTabIndex } from './rovingTabs.js';

describe('parseDraftInt', () => {
  it('clamps to the minimum and falls back on an empty or junk draft', () => {
    expect(parseDraftInt('3', 1, 1)).toBe(3);
    expect(parseDraftInt('0', 1, 1)).toBe(1);
    expect(parseDraftInt('-4', 1, 1)).toBe(1);
    expect(parseDraftInt('', 1, 1)).toBe(1);
    expect(parseDraftInt('', 2, 4)).toBe(4);
    expect(parseDraftInt('abc', 2, 4)).toBe(4);
  });
});

describe('nextTabIndex', () => {
  it('moves and wraps with the arrow keys, jumps with Home/End, ignores the rest', () => {
    expect(nextTabIndex('ArrowRight', 0, 5)).toBe(1);
    expect(nextTabIndex('ArrowRight', 4, 5)).toBe(0);
    expect(nextTabIndex('ArrowLeft', 0, 5)).toBe(4);
    expect(nextTabIndex('Home', 3, 5)).toBe(0);
    expect(nextTabIndex('End', 1, 5)).toBe(4);
    expect(nextTabIndex('a', 1, 5)).toBeNull();
  });
});
