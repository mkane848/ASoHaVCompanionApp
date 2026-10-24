import { useState } from 'react';

/** parseInt a text draft and clamp it to `min`; an empty or non-numeric draft yields `fallback`. */
export function parseDraftInt(draft: string, min: number, fallback: number): number {
  const n = parseInt(draft, 10);
  return Number.isNaN(n) ? fallback : Math.max(min, n);
}

/** A number input's text draft. The field may sit empty while the player retypes (no snap-back on
 *  every keystroke); `value` is always the clamped number, and the draft is tidied on blur. */
export function useDraftInt(initial: number, min: number, fallback = min) {
  const [draft, setDraft] = useState(String(initial));
  const value = parseDraftInt(draft, min, fallback);
  return {
    value,
    set: (n: number) => setDraft(String(n)),
    inputProps: {
      value: draft,
      onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
      onBlur: () => setDraft(String(value)),
    },
  };
}
