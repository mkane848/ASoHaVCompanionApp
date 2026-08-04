import { settingsFields, type GameSettings } from '@asohav/shared';
import shared from './adminShared.module.css';

/** Kin is the third Advancement track (Potential = personal, Rapport = party, Kin = social —
 *  scoped to a Bond between two PCs), but unlike the other two it has no authored library
 *  content to browse or edit here: Mark Kin and Forge Bond are played out live through the Bond
 *  handshake on the Campaign Shell / Character Sheet, and Forging stays a freeform move the two
 *  players write together rather than a pick from a Tier-gated list. This view exists so Kin has
 *  a permanent home in the nav for whatever Kin-specific content or rules land later, rather than
 *  reusing Settings or leaving Kin out of the Advancements group entirely. */
export function KinAdvancementView({ settings }: { settings: GameSettings }) {
  const kinTrackLength = settingsFields.find((f) => f.name === 'KinTrackLength');

  return (
    <div>
      <h2 className={shared.viewTitle}>Kin</h2>
      <p className={shared.viewIntro}>Social Advancement — scoped to a Bond between two PCs.</p>
      <p>
        There's no authored Kin content to manage yet. Marking Kin and Forging a Bond happen live
        through the Bond handshake in the Campaign Shell and on the Character Sheet's Kin &amp;
        Bonds panel — Forging is still a move the two players write together, not a pick from a
        list, so there's nothing here to browse or edit today.
      </p>
      <p>
        This entry stays in the nav for when that changes — a Bond Move library keyed by Bond
        Level, or other Kin-specific rules content.
      </p>
      {kinTrackLength && (
        <p className={shared.hint}>
          {kinTrackLength.label} is currently {settings.KinTrackLength} — edit it under
          Tools&nbsp;&rarr;&nbsp;Settings.
        </p>
      )}
    </div>
  );
}
