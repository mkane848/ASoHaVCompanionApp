import { DAMAGE_TIER_OPACITY } from '@asohav/shared';

const NOISE_A =
  "url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22200%22%20height=%22200%22%3E%3Cfilter%20id=%22n%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.65%22%20numOctaves=%224%22%20stitchTiles=%22stitch%22/%3E%3CfeColorMatrix%20type=%22saturate%22%20values=%220%22/%3E%3C/filter%3E%3Crect%20width=%22200%22%20height=%22200%22%20filter=%22url(%23n)%22%20opacity=%220.5%22/%3E%3C/svg%3E')";
const NOISE_B =
  "url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22220%22%20height=%22220%22%3E%3Cfilter%20id=%22m%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.55%22%20numOctaves=%224%22%20stitchTiles=%22stitch%22/%3E%3CfeColorMatrix%20type=%22saturate%22%20values=%220%22/%3E%3C/filter%3E%3Crect%20width=%22220%22%20height=%22220%22%20filter=%22url(%23m)%22%20opacity=%220.5%22/%3E%3C/svg%3E')";

const BLOTCHES_A =
  'radial-gradient(ellipse at 11% 16%,rgba(96,56,28,.55) 0%,transparent 40%),' +
  'radial-gradient(ellipse at 81% 9%,rgba(96,56,28,.4) 0%,transparent 36%),' +
  'radial-gradient(ellipse at 89% 79%,rgba(88,50,24,.48) 0%,transparent 42%),' +
  'radial-gradient(ellipse at 27% 93%,rgba(96,56,28,.38) 0%,transparent 38%),' +
  'radial-gradient(circle at 52% 48%,rgba(74,42,20,.2) 0%,transparent 72%)';
const BLOTCHES_B =
  'radial-gradient(ellipse at 14% 12%,rgba(96,56,28,.5) 0%,transparent 38%),' +
  'radial-gradient(ellipse at 84% 22%,rgba(88,50,24,.42) 0%,transparent 34%),' +
  'radial-gradient(ellipse at 76% 88%,rgba(96,56,28,.5) 0%,transparent 40%),' +
  'radial-gradient(ellipse at 22% 74%,rgba(88,50,24,.36) 0%,transparent 36%),' +
  'radial-gradient(circle at 50% 50%,rgba(74,42,20,.18) 0%,transparent 70%)';

/** The page gets ruined as the character does. A single overlay with computed opacity from
 *  a 4-step scale — the prototype used four literal variants only because its format
 *  penalised dynamic style values; here we just interpolate. Must be the FIRST child of a
 *  `position: relative` panel, with the panel's real content in a sibling `position: relative`
 *  wrapper after it — positioned elements paint above static in-flow siblings, so without that
 *  wrapper every row would sit under the dirt. */
export function DamageOverlay({ tier, variant }: { tier: 0 | 1 | 2 | 3 | 4; variant: 'virtues' | 'statuses' }) {
  if (tier <= 0) return null;
  const noise = variant === 'virtues' ? NOISE_A : NOISE_B;
  const blotches = variant === 'virtues' ? BLOTCHES_A : BLOTCHES_B;
  const shadowBlur = variant === 'virtues' ? 46 : 52;
  const shadowAlpha = variant === 'virtues' ? 0.4 : 0.42;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
        backgroundImage: `${noise},${blotches}`,
        boxShadow: `inset 0 0 ${shadowBlur}px rgba(84,46,20,${shadowAlpha})`,
        opacity: DAMAGE_TIER_OPACITY[tier],
      }}
    />
  );
}
