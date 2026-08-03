import type { CSSProperties } from 'react';

/** Pips carry a magnitude, not a clock: tapping pip n sets the value to n; tapping the
 *  currently-filled pip drops it to n-1.
 *
 *  Sizing is split between here and layout.css. The dot's painted size is whatever
 *  `size` says, at every viewport — that doesn't change. What the CSS adds is hit area:
 *  each pip claims its own slot (the dot plus the half-gap either side) so neighbouring
 *  targets tile edge to edge, and the slot widens to the full 44px on touch devices.
 *  Giving each pip a naive 44px box instead would have overlapped its neighbours by
 *  19px, turning near-misses into confident wrong hits. */
export function Pips({
  count,
  filled,
  color,
  size = 19,
  onSet,
}: {
  count: number;
  filled: number;
  color: string;
  size?: number;
  onSet: (n: number) => void;
}) {
  return (
    <div
      className="pip-row"
      style={{ '--pip-size': `${size}px`, '--pip-gap-base': size >= 18 ? '6px' : '4px' } as CSSProperties}
    >
      {Array.from({ length: count }, (_, idx) => {
        const i = idx + 1;
        const on = i <= filled;
        return (
          <button
            key={i}
            type="button"
            className="pip"
            title={`Set to ${i}`}
            onClick={() => onSet(filled === i ? i - 1 : i)}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              padding: 0,
              border: `1.5px solid ${on ? color : 'rgba(42,32,26,.28)'}`,
              background: on ? color : 'transparent',
            }}
          />
        );
      })}
    </div>
  );
}
