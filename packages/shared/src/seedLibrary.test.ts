import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { seedLibrary } from './seedLibrary.js';

// Every Basic Move heading in the canonical ruleset names the Virtue(s) it rolls: "## Strike a
// Nerve (Guile)", "## Discern the Truth (Wit/Heart)", "## Take a Risk (Any)". A Move that rolls
// exactly one carries that VirtueId, which is what files it under that Virtue in the Moves drawer
// and fixes it in the roll builder; one that rolls a choice carries null so the builder asks.
// Read from the ruleset itself rather than a hand-copied table: m-strike sat at null from 0.45.0
// (when its text went from "+Might or +Guile" to "+Guile") until 0.64.3, because nothing compared
// the seed's VirtueId against the heading it came from.
const RULESET = readFileSync(new URL('../../../Planning Docs/Ruleset-V0.6.md', import.meta.url), 'utf8');

function basicMoveHeadings(): { heading: string; name: string; virtues: string[] }[] {
  const start = RULESET.indexOf('\n# Basic Moves\n');
  const end = RULESET.indexOf('\n# ', start + 1);
  const section = RULESET.slice(start, end);
  return [...section.matchAll(/^## .*$/gm)].map(([heading]) => {
    // "## Offer Solace \- (Heart) " carries a markdown-escaped hyphen and a trailing space.
    const m = /^## (.+?)\s*(?:\\-\s*)?\(([^)]+)\)\s*$/.exec(heading);
    if (!m) throw new Error(`Basic Move heading names no Virtue: ${JSON.stringify(heading)}`);
    return { heading, name: m[1], virtues: m[2].split('/').map((v) => v.trim()) };
  });
}

describe('seeded Basic Moves follow their ruleset headings', () => {
  const library = seedLibrary();
  const headings = basicMoveHeadings();

  function moveFor(name: string) {
    const move = library.moves.find((m) => m.Name === name);
    expect(move, `no seeded Move named "${name}"`).toBeDefined();
    return move!;
  }

  it('finds every Basic Move heading in the seed', () => {
    expect(headings.length).toBeGreaterThan(0);
    for (const { name } of headings) moveFor(name);
  });

  it('gives a Move whose heading names exactly one Virtue that VirtueId', () => {
    const single = headings.filter((h) => h.virtues.length === 1 && h.virtues[0] !== 'Any');
    expect(single.length).toBeGreaterThan(0);
    for (const { heading, name, virtues } of single) {
      const virtue = library.virtues.find((v) => v.Name === virtues[0]);
      expect(virtue, `${heading}: no seeded Virtue named "${virtues[0]}"`).toBeDefined();
      expect(moveFor(name).VirtueId, heading).toBe(virtue!.Id);
    }
  });

  it('leaves VirtueId null on a Move whose heading offers a choice of Virtue', () => {
    const choice = headings.filter((h) => h.virtues.length > 1 || h.virtues[0] === 'Any');
    expect(choice.length).toBeGreaterThan(0);
    for (const { heading, name } of choice) {
      expect(moveFor(name).VirtueId, heading).toBeNull();
    }
  });
});
