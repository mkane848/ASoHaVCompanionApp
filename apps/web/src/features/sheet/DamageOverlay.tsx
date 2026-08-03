import { DAMAGE_TIER_OPACITY } from '@asohav/shared';
import styles from './DamageOverlay.module.css';

/** The page gets ruined as the character does. A single overlay with computed opacity from
 *  a 4-step scale — the prototype used four literal variants only because its format
 *  penalised dynamic style values; here we just interpolate. Must be the FIRST child of a
 *  `position: relative` panel, with the panel's real content in a sibling `position: relative`
 *  wrapper after it — positioned elements paint above static in-flow siblings, so without that
 *  wrapper every row would sit under the dirt. */
export function DamageOverlay({ tier, variant }: { tier: 0 | 1 | 2 | 3 | 4; variant: 'virtues' | 'statuses' }) {
  if (tier <= 0) return null;
  return (
    <div
      className={`${styles.overlay} ${styles[variant]}`}
      /* Opacity is the one genuinely computed value here, so it stays inline. */
      style={{ opacity: DAMAGE_TIER_OPACITY[tier] }}
    />
  );
}
