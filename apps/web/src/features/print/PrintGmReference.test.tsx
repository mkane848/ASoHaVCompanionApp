// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { seedLibrary, type GmReferenceSection, type Library } from '@asohav/shared';
import { parseGmReferenceBody, type GmReferenceListItem } from '../gm/gmReferenceBody.js';
import { PrintGmReference } from './PrintGmReference.js';
import {
  GM_REFERENCE_BLOCK_PRINT_COVERAGE,
  GM_REFERENCE_ITEM_PRINT_COVERAGE,
  GM_REFERENCE_SECTION_PRINT_COVERAGE,
} from './printGmReferenceCoverage.js';
import type { Coverage } from './printCoverage.js';

/**
 * The drift guard for the printable GM Reference, the counterpart of PrintSheet.test.tsx:
 *
 *  (a) the print of the seed library contains every section title and every line of every Body,
 *      including each Principle and each Move by name;
 *  (b) an edit to the library (a renamed Principle, an added Move, a new section) reaches the page;
 *  (c) each coverage map names exactly the fields the real data has.
 *
 * The other half of (c) is the compiler: each map is `Record<keyof T, Coverage>`.
 */

afterEach(cleanup);

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function pageText(library: Library, hidden?: ReadonlySet<string>): string {
  const { container } = render(<PrintGmReference library={library} campaignName="Test Campaign" hidden={hidden} />);
  return norm(container.textContent ?? '');
}

/** Every line a Body parses into: paragraph lines and every bullet at every depth. */
function bodyLines(body: string): string[] {
  const out: string[] = [];
  const walk = (items: GmReferenceListItem[]) => {
    for (const it of items) {
      out.push(it.text);
      walk(it.children ?? []);
    }
  };
  for (const b of parseGmReferenceBody(body)) {
    if (b.type === 'paragraph') out.push(...(b.lines ?? []));
    else walk(b.items ?? []);
  }
  return out.map(norm);
}

const topLevel = (section: GmReferenceSection) =>
  parseGmReferenceBody(section.Body).flatMap((b) => (b.type === 'list' ? (b.items ?? []) : []));

describe('printable GM Reference — seed library', () => {
  const library = seedLibrary();
  const sections = [...library.gmReference].sort((a, b) => a.Order - b.Order);
  const text = pageText(library);

  it('has the four sections, 23 Principles and 27 Moves the drawer shows', () => {
    expect(sections).toHaveLength(4);
    expect(topLevel(sections.find((s) => s.Id === 'gmr-principles')!)).toHaveLength(23);
    expect(topLevel(sections.find((s) => s.Id === 'gmr-moves')!)).toHaveLength(27);
  });

  it('prints every section title, in Order', () => {
    const { container } = render(<PrintGmReference library={library} />);
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent);
    expect(headings).toEqual(sections.map((s) => s.Name));
  });

  it('prints every line of every section, and each Principle and Move by name', () => {
    const lost = sections.flatMap((s) => bodyLines(s.Body).filter((l) => !text.includes(l)).map((l) => `${s.Name}: ${l}`));
    expect(lost).toEqual([]);
    for (const id of ['gmr-principles', 'gmr-moves']) {
      for (const item of topLevel(sections.find((s) => s.Id === id)!)) expect(text).toContain(norm(item.text));
    }
  });

  it('keeps each Principle and Move as one list item (so print can keep it whole)', () => {
    const { container } = render(<PrintGmReference library={library} />);
    const items = container.querySelectorAll('section > ul > li');
    const expected = sections.reduce((n, s) => n + topLevel(s).length, 0);
    expect(items).toHaveLength(expected);
  });

  it('holds every printed field of every shape to account', () => {
    const probes = {
      Name: () => sections.map((s) => s.Name),
      Body: () => sections.flatMap((s) => bodyLines(s.Body)),
      Order: () => sections.map((s) => s.Name), // the order itself: asserted by the heading test above
    };
    const problems: string[] = [];
    for (const key of Object.keys(GM_REFERENCE_SECTION_PRINT_COVERAGE) as (keyof typeof GM_REFERENCE_SECTION_PRINT_COVERAGE)[]) {
      const c = GM_REFERENCE_SECTION_PRINT_COVERAGE[key];
      if (!c.printed) continue;
      const probe = probes[key as keyof typeof probes];
      if (!probe) {
        problems.push(`GmReferenceSection.${key} is marked printed (${c.where}) but this test has no probe for it`);
        continue;
      }
      for (const e of probe()) if (!text.includes(norm(e))) problems.push(`GmReferenceSection.${key}: page lacks ${JSON.stringify(e)}`);
    }
    expect(problems).toEqual([]);
  });

  it('omits a section the preview toolbar switched off', () => {
    const { container } = render(<PrintGmReference library={library} hidden={new Set(['gmr-moves'])} />);
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent);
    expect(headings).not.toContain('GM Moves');
    expect(headings).toContain('GM Principles');
  });
});

describe('printable GM Reference — a library edit reaches the page', () => {
  it('shows a renamed Principle, an added Move and an added section', () => {
    const library = structuredClone(seedLibrary());
    const principles = library.gmReference.find((s) => s.Id === 'gmr-principles')!;
    principles.Body = principles.Body.replace('- Yes, and', '- Yes, and also: a renamed principle');
    const moves = library.gmReference.find((s) => s.Id === 'gmr-moves')!;
    moves.Body += '\n- A brand new test move\n  - with a nested note';
    library.gmReference.push({ Id: 'gmr-extra', Name: 'Table Notes', Body: 'A new paragraph.\nSecond line.', Order: 99 });

    const text = pageText(library);
    expect(text).toContain('Yes, and also: a renamed principle');
    expect(text).toContain('A brand new test move');
    expect(text).toContain('with a nested note');
    expect(text).toContain('Table Notes');
    expect(text).toContain('A new paragraph.');
    expect(text).toContain('Second line.');
  });

  it('says so, rather than printing a blank page, when the library has no GM reference', () => {
    const library = structuredClone(seedLibrary());
    library.gmReference = [];
    expect(pageText(library)).toContain('no GM reference yet');
  });
});

describe('printable GM Reference — coverage maps', () => {
  const keyMismatch = (coverage: Record<string, unknown>, sample: object, mode: 'exact' | 'subset' = 'exact') => {
    const cov = Object.keys(coverage);
    const keys = Object.keys(sample);
    return [
      ...keys.filter((k) => !cov.includes(k)).map((k) => `data has "${k}", coverage map does not`),
      ...(mode === 'exact' ? cov.filter((k) => !keys.includes(k)).map((k) => `coverage map has "${k}", data does not`) : []),
    ];
  };

  it('name exactly the keys of the real data (optional keys may be absent from a row)', () => {
    const library = seedLibrary();
    const problems = [
      ...library.gmReference.flatMap((s) => keyMismatch(GM_REFERENCE_SECTION_PRINT_COVERAGE, s).map((p) => `GmReferenceSection: ${p}`)),
    ];
    const blocks = library.gmReference.flatMap((s) => parseGmReferenceBody(s.Body));
    problems.push(...blocks.flatMap((b) => keyMismatch(GM_REFERENCE_BLOCK_PRINT_COVERAGE, b, 'subset').map((p) => `GmReferenceBlock: ${p}`)));
    const items: GmReferenceListItem[] = [];
    const walk = (list: GmReferenceListItem[]) => list.forEach((i) => { items.push(i); walk(i.children ?? []); });
    blocks.forEach((b) => walk(b.items ?? []));
    problems.push(...items.flatMap((i) => keyMismatch(GM_REFERENCE_ITEM_PRINT_COVERAGE, i, 'subset').map((p) => `GmReferenceListItem: ${p}`)));
    expect(items.length).toBeGreaterThan(50);
    expect(problems).toEqual([]);
  });

  it('notice a missing or a surplus key (the check itself works)', () => {
    const section = seedLibrary().gmReference[0]!;
    const without = { ...GM_REFERENCE_SECTION_PRINT_COVERAGE } as Record<string, Coverage>;
    delete without.Body;
    expect(keyMismatch(without, section)).toEqual(['data has "Body", coverage map does not']);
    const ghost = { ...GM_REFERENCE_SECTION_PRINT_COVERAGE, Ghost: { printed: true, where: 'nowhere' } } as Record<string, Coverage>;
    expect(keyMismatch(ghost, section)).toEqual(['coverage map has "Ghost", data does not']);
  });

  it('give every unprinted field a reason and every printed one a place', () => {
    const all: Record<string, Coverage>[] = [
      GM_REFERENCE_SECTION_PRINT_COVERAGE, GM_REFERENCE_BLOCK_PRINT_COVERAGE, GM_REFERENCE_ITEM_PRINT_COVERAGE,
    ];
    const empty = all.flatMap((m) => Object.entries(m).filter(([, c]) => (c.printed ? !c.where.trim() : !c.reason.trim())).map(([k]) => k));
    expect(empty).toEqual([]);
  });
});
