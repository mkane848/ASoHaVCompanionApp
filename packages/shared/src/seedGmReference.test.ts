import { describe, it, expect } from 'vitest';
import { GM_REFERENCE } from './seedGmReference.js';

describe('GM_REFERENCE', () => {
  it('contains four sections with Order 1-4 and unique Ids', () => {
    expect(GM_REFERENCE).toHaveLength(4);
    expect(GM_REFERENCE.map((s) => s.Order)).toEqual([1, 2, 3, 4]);
    const ids = GM_REFERENCE.map((s) => s.Id);
    expect(new Set(ids).size).toBe(4);
  });

  it('GM Principles has 23 top-level list items', () => {
    const principles = GM_REFERENCE.find((s) => s.Id === 'gmr-principles');
    expect(principles).toBeDefined();
    const topLevelItems = principles!.Body.split('\n').filter((line) => /^- /.test(line));
    expect(topLevelItems).toHaveLength(23);
  });

  it('GM Moves has 27 top-level list items', () => {
    const moves = GM_REFERENCE.find((s) => s.Id === 'gmr-moves');
    expect(moves).toBeDefined();
    const topLevelItems = moves!.Body.split('\n').filter((line) => /^- /.test(line));
    expect(topLevelItems).toHaveLength(27);
  });

  it('no Body contains markdown escapes, emphasis markers, or trailing spaces', () => {
    for (const section of GM_REFERENCE) {
      expect(section.Body).not.toMatch(/\\/);
      expect(section.Body).not.toMatch(/\*\*/);
      const lines = section.Body.split('\n');
      for (const line of lines) {
        expect(line).not.toMatch(/ $/);
      }
    }
  });
});
