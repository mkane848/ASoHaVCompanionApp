import { settingsFields, type GameSettings } from '@asohav/shared';
import shared from './adminShared.module.css';

/** Bond is a real Improvement-bearing track (Ruleset-V0.5.md's "Bond Track + Improvements"), but
 *  unlike Hero's 25 named trees, its own section names none at all — nothing to browse or edit
 *  here (see HANDOFF.md open issue 12). Marking Bond and Forging a Bond are played out live
 *  through the Bond handshake on the Campaign Shell / Character Sheet, and Forging stays a
 *  freeform move the two players write together rather than a pick from a tree. This view exists
 *  so Bond has a permanent home in the nav for whatever Bond-specific content lands later, rather
 *  than reusing Settings or leaving Bond out of the Improvements group entirely. */
export function BondAdvancementView({ settings }: { settings: GameSettings }) {
  const bondTrackLength = settingsFields.find((f) => f.name === 'BondTrackLength');

  return (
    <div>
      <h2 className={shared.viewTitle}>Bond</h2>
      <p className={shared.viewIntro}>Social Advancement — scoped to a Bond between two PCs.</p>
      <p>
        There's no authored Bond content to manage yet. Marking Bond and Forging a Bond happen live
        through the Bond handshake in the Campaign Shell and on the Character Sheet's Bond panel —
        Forging is still a move the two players write together, not a pick from a list, so there's
        nothing here to browse or edit today.
      </p>
      <p>
        This entry stays in the nav for when that changes — a Bond Move library keyed by Bond
        Level, or other Bond-specific rules content.
      </p>
      {bondTrackLength && (
        <p className={shared.hint}>
          {bondTrackLength.label} is currently {settings.BondTrackLength} — edit it under
          Tools&nbsp;&rarr;&nbsp;Settings.
        </p>
      )}
    </div>
  );
}
