import type { CharacterSheet, Library, Move, Party } from '@asohav/shared';
import { HeroRollBuilder } from '../roll/HeroRollBuilder.js';
import { TierReport } from '../roll/TierReport.js';

/** "What to roll" for a Basic Move in the Moves drawer: the Hero Roll builder in Move mode, with the
 *  tier report underneath. Moves with no fixed Virtue ("Invoke Expertise", "Take a Risk") let the
 *  player pick which one fits the fictional action first. */
export function MoveRollHelper({
  move,
  sheet,
  library,
  commit,
  party,
  commitParty,
  myName,
  otherHeroNames,
}: {
  move: Move;
  sheet: CharacterSheet;
  library: Library;
  commit: (mutator: (draft: CharacterSheet) => void) => void;
  party: Party;
  commitParty: (mutator: (draft: Party) => void) => void;
  myName: string;
  /** The other Heroes in the Party, for Work Together. */
  otherHeroNames: string[];
}) {
  return (
    <HeroRollBuilder mode="Move" virtueId={move.VirtueId} sheet={sheet} library={library} commit={commit} party={party} commitParty={commitParty} myName={myName} otherHeroNames={otherHeroNames}>
      <TierReport move={move} sheet={sheet} library={library} commit={commit} />
    </HeroRollBuilder>
  );
}
