import type { CSSProperties, ReactNode } from 'react';
import { DamageOverlay } from './DamageOverlay.js';

export function Panel({
  id,
  primary,
  grain,
  damageTier,
  damageVariant,
  children,
  style,
}: {
  id?: string;
  primary?: boolean;
  grain?: boolean;
  damageTier?: 0 | 1 | 2 | 3 | 4;
  damageVariant?: 'virtues' | 'statuses';
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      id={id}
      className={[grain ? 'panel-grain' : '', id ? 'panel-anchor' : ''].filter(Boolean).join(' ') || undefined}
      style={{
        position: 'relative',
        background: 'var(--panel)',
        border: '1px solid var(--rule)',
        borderTop: primary ? '2px solid var(--gold)' : undefined,
        padding: '20px 22px',
        ...style,
      }}
    >
      {damageTier !== undefined && damageVariant && <DamageOverlay tier={damageTier} variant={damageVariant} />}
      {/* Load-bearing: positioned siblings (the overlay) paint above static in-flow content,
          so real content needs its own `position: relative` to sit on top. */}
      <div style={{ position: 'relative' }}>{children}</div>
    </section>
  );
}

export function PanelHeader({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 23, margin: 0 }}>{children}</h2>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(157,124,51,.55), rgba(157,124,51,0))' }} />
      {extra}
    </div>
  );
}
