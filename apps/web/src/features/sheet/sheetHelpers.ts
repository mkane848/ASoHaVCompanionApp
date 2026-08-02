import type { AbilityEffect, Library } from '@asohav/shared';

export const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Effect chips are generated from the structured `Effects` — e.g. "PHYSICAL ARMOR +1",
 *  "MODIFIES ASSESS THE SITUATION", "HOLD 1". */
export function effectChipLabel(e: AbilityEffect, library: Library): string {
  switch (e.Kind) {
    case 'VirtueBoost': {
      const v = library.virtues.find((x) => x.Id === e.VirtueId);
      return `${v ? v.Name : ''} ${sign(e.Value ?? 0)} ${e.Duration ?? ''}`.trim();
    }
    case 'RollBonus':
      return `${sign(e.Value ?? 0)} ${e.Duration ?? ''}`.trim();
    case 'GrantArmor': {
      const at = library.armorTypes.find((x) => x.Id === e.ArmorTypeId);
      return `${at ? at.Name : ''} armor +${e.Count ?? 0}`.trim();
    }
    case 'GrantStatus':
      return `${e.StatusName ?? ''} ${e.Rank ?? ''}`.trim();
    case 'Hold':
      return `hold ${e.Count ?? 0}`;
    case 'ModifyMove': {
      const mv = library.moves.find((x) => x.Id === e.MoveId);
      return `modifies ${mv ? mv.Name : 'a move'}`;
    }
    case 'ResourceChange':
      return `${e.Resource ?? ''} ${sign(e.Value ?? 0)}`.trim();
    case 'Narrative':
      return 'narrative';
    default:
      return e.Kind;
  }
}
