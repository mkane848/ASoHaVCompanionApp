import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { DamageOverlay } from './DamageOverlay.js';
import { usePanelCollapseStore } from '../../store/panelCollapseStore.js';

/** Set by a collapsible Panel, read by its PanelHeader.
 *
 *  The context exists because the header arrives as one of Panel's children, so
 *  Panel can't reach into it to add a toggle. The header renders the control;
 *  Panel hides the rest of the body with a class (.panel-collapsed, in
 *  layout.css) rather than by filtering children, which would quietly depend on
 *  the header being child number one. */
const CollapseContext = createContext<{ collapsed: boolean; toggle: () => void } | null>(null);

export function Panel({
  id,
  collapseId,
  primary,
  grain,
  damageTier,
  damageVariant,
  children,
  style,
}: {
  id?: string;
  /** Enables folding, and is the key the open/closed state persists under. */
  collapseId?: string;
  primary?: boolean;
  grain?: boolean;
  damageTier?: 0 | 1 | 2 | 3 | 4;
  damageVariant?: 'virtues' | 'statuses';
  children: ReactNode;
  style?: CSSProperties;
}) {
  const collapsedMap = usePanelCollapseStore((s) => s.collapsed);
  const toggleCollapse = usePanelCollapseStore((s) => s.toggle);
  const collapsed = !!collapseId && !!collapsedMap[collapseId];

  const body = (
    <section
      id={id}
      className={
        [grain ? 'panel-grain' : '', id ? 'panel-anchor' : '', collapsed ? 'panel-collapsed' : '']
          .filter(Boolean)
          .join(' ') || undefined
      }
      style={{
        position: 'relative',
        background: 'var(--panel)',
        border: '1px solid var(--rule)',
        borderTop: primary ? '2px solid var(--gold)' : undefined,
        padding: collapsed ? '14px 22px' : '20px 22px',
        ...style,
      }}
    >
      {damageTier !== undefined && damageVariant && !collapsed && <DamageOverlay tier={damageTier} variant={damageVariant} />}
      {/* Load-bearing: positioned siblings (the overlay) paint above static in-flow content,
          so real content needs its own `position: relative` to sit on top. */}
      <div style={{ position: 'relative' }}>{children}</div>
    </section>
  );

  if (!collapseId) return body;
  return <CollapseContext.Provider value={{ collapsed, toggle: () => toggleCollapse(collapseId) }}>{body}</CollapseContext.Provider>;
}

export function PanelHeader({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  const collapse = useContext(CollapseContext);
  const heading = <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 23, margin: 0 }}>{children}</h2>;

  return (
    <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
      {collapse ? (
        <button
          type="button"
          className="tap-inline"
          onClick={collapse.toggle}
          aria-expanded={!collapse.collapsed}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'inherit',
            textAlign: 'left',
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 12,
              color: 'var(--gold-dark)',
              display: 'inline-block',
              transform: collapse.collapsed ? 'rotate(-90deg)' : 'none',
              transition: 'transform .15s ease-out',
            }}
          >
            ▾
          </span>
          {heading}
        </button>
      ) : (
        heading
      )}
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(157,124,51,.55), rgba(157,124,51,0))' }} />
      {extra}
    </div>
  );
}
