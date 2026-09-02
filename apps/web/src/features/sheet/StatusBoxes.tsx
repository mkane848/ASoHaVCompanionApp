import type { CSSProperties } from 'react';
import { statusRank } from '@asohav/shared';

/** A Status's row of boxes (ruleset V0.5, `0.28.0`). Deliberately NOT `Pips`.
 *
 *  `Pips` carries a magnitude: tapping pip n means "the value is now n", so its fill is
 *  cumulative (`i <= filled`) and every box left of the tapped one lights up. That is still
 *  right for Potential, Rapport, the Bond Track and item Charges, which really are clocks
 *  filling from the left — so `Pips` is untouched and those keep using it.
 *
 *  A Status is not a clock. Its row is **sparse on purpose**: gaining Rank 2 and then Rank 4
 *  marks boxes 2 and 4 and leaves 1 and 3 empty, and the Rank is the highest marked box — 4,
 *  not 2, and not "two marks". Rendering that with cumulative fill would draw a different,
 *  wrong row, which is why this is a separate component rather than a flag on `Pips`.
 *
 *  **Tapping toggles exactly one box**, and nothing else moves. It would be tidier-looking to
 *  clear everything to the right of an un-tapped box, but that would destroy the legal sparse
 *  rows above — and the give/heal paths (`giveStatus`, `healStatus`) already enforce the real
 *  rules. These boxes are direct manual correction, so they do the literal thing.
 *
 *  Sizing and hit area are inherited wholesale from `.pip-row`/`.pip` in `layout.css` — same
 *  classes, same custom properties, same painted size. That is load-bearing, not incidental:
 *  six 19px boxes span exactly 239px on a coarse pointer, which `StatusesPanel.module.css`'s
 *  `.pipsCell` negative-margin bleed and its 1024px reset are both derived against. Any change
 *  to the geometry here has to re-derive that arithmetic. */
export function StatusBoxes({
  marks,
  color,
  size = 19,
  subduedFrom,
  onToggle,
}: {
  marks: boolean[];
  color: string;
  size?: number;
  /** 1-based box index that means Subdued rather than a normal Rank (the last box). Drawn with
   *  the danger colour so the overflow box doesn't read as "just a bigger Rank 5". */
  subduedFrom?: number;
  onToggle: (boxIndex: number) => void;
}) {
  const rank = statusRank({ Marks: marks });
  return (
    <div
      className="pip-row"
      style={{ '--pip-size': `${size}px`, '--pip-gap-base': size >= 18 ? '6px' : '4px' } as CSSProperties}
      role="group"
      aria-label={`Status rank ${rank}`}
    >
      {marks.map((on, idx) => {
        const i = idx + 1;
        const isSubduedBox = subduedFrom != null && i >= subduedFrom;
        const boxColor = isSubduedBox ? 'var(--danger)' : color;
        return (
          <button
            key={i}
            type="button"
            className="pip"
            aria-pressed={on}
            aria-label={isSubduedBox ? `Box ${i} (Subdued)` : `Box ${i}`}
            title={isSubduedBox ? `Box ${i} — Subdued` : `Box ${i}`}
            onClick={() => onToggle(i)}
            /* Square, not round: a Status box is a box in the rules text, and the different
               silhouette is also how a player tells a sparse Status row from a Pips clock at a
               glance. Size and colour stay inline (caller-supplied); everything structural is
               on .pip in layout.css. */
            style={{
              width: size,
              height: size,
              borderRadius: 2,
              padding: 0,
              border: `1.5px solid ${on ? boxColor : 'var(--ink-28)'}`,
              background: on ? boxColor : 'transparent',
            }}
          />
        );
      })}
    </div>
  );
}
