import type { RollShape } from '@asohav/shared';

/** The dice-odds readout for the roll as built (revised V0.6 slice 9) — admin-only, behind Debug
 *  mode; `HeroRollBuilder` renders it only when `useDebugMode()` is true. Contract stub — WP 9B. */
export interface OddsPanelProps {
  /** The capped final modifier (`RollBreakdown.Total`). */
  modifier: number;
  shape: RollShape;
  /** Anything the readout can't account for, e.g. a Major Status's Disadvantage (how it combines
   *  with Boons and Banes is an open question the app doesn't answer). */
  note?: string;
}

export function OddsPanel(props: OddsPanelProps) {
  void props;
  return null;
}
