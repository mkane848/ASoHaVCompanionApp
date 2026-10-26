import type { GmReferenceSection } from '@asohav/shared';
import type { GmReferenceBlock, GmReferenceListItem } from '../gm/gmReferenceBody.js';
import type { Coverage } from './printCoverage.js';

/**
 * The drift guard for the printable GM Reference (`PrintGmReference.tsx`).
 *
 * Same contract as `printCoverage.ts`: every map is a `Record<keyof T, Coverage>`, so a field added
 * to `GmReferenceSection` (the wire shape in `packages/shared/src/types.ts`) or to the two shapes
 * `parseGmReferenceBody` turns a section's `Body` into fails `tsc` until somebody decides, here,
 * whether it prints. `PrintGmReference.test.tsx` then holds each `printed: true` entry to account
 * by looking for the value on the rendered page.
 *
 * What prints is whatever `library.gmReference` holds, read the way `GmReferenceDrawer` reads it:
 * sorted by `Order`, each `Body` parsed by `parseGmReferenceBody`. No rules text lives in the
 * print layout, so an edit in Content Admin reaches paper with no edit here.
 */

const yes = (where: string): Coverage => ({ printed: true, where });
const no = (reason: string): Coverage => ({ printed: false, reason });

export const GM_REFERENCE_SECTION_PRINT_COVERAGE: Record<keyof GmReferenceSection, Coverage> = {
  Id: no("Bookkeeping identifier (it keys the drawer's scroll anchors); has no meaning on paper."),
  Name: yes('Section heading'),
  Body: yes('Section text: paragraphs and the nested bullet list, line for line'),
  Order: yes('Section order (ascending, as in the drawer); the number itself does not print'),
};

export const GM_REFERENCE_BLOCK_PRINT_COVERAGE: Record<keyof GmReferenceBlock, Coverage> = {
  type: yes('Paragraph or bullet list'),
  lines: yes('Paragraph text, one source line per printed line'),
  items: yes('Bullet list'),
};

export const GM_REFERENCE_ITEM_PRINT_COVERAGE: Record<keyof GmReferenceListItem, Coverage> = {
  level: no("The parser's indentation bookkeeping; the nesting itself prints (children are indented)."),
  text: yes('Bullet text'),
  children: yes('Nested bullets, indented under their parent'),
};
