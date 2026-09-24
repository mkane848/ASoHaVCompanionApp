import { createContext, useContext } from 'react';

/** "The tier has been reported" for the roll `HeroRollBuilder` is building — it uses up any Forward
 *  reminder applied to this roll (revised V0.6 slice 9). A report rendered inside the builder
 *  (`TierReport`, as its `children`) reads this; a dialog that reports the tier outside the
 *  builder (a Resist, an Engage) calls the same thing through the builder's `ref`
 *  (`HeroRollBuilderHandle`). */
export const RollReportContext = createContext<(() => void) | null>(null);

export function useRollReported(): (() => void) | null {
  return useContext(RollReportContext);
}
