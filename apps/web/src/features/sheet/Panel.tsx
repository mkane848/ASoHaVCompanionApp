import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { DamageOverlay } from './DamageOverlay.js';
import { usePanelCollapseStore } from '../../store/panelCollapseStore.js';
import styles from './Panel.module.css';

/** Set by a collapsible Panel, read by its PanelHeader.
 *
 *  The context exists because the header arrives as one of Panel's children, so
 *  Panel can't reach into it to add a toggle. The header renders the control;
 *  Panel hides the rest of the body with a class rather than by filtering
 *  children, which would quietly depend on the header being child number one. */
const CollapseContext = createContext<{ collapsed: boolean; toggle: () => void } | null>(null);

/* Global class names, not module ones: these are the contract between Panel and
   the utilities layer in layout.css, which needs to select them by a stable
   name (`panel-anchor` for the scroll offset, `panel-collapsed`/`panel-header`
   for folding, `panel-grain` for the paper texture in base.css). */
const GRAIN = 'panel-grain';
const ANCHOR = 'panel-anchor';
const COLLAPSED = 'panel-collapsed';
const HEADER = 'panel-header';

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
      className={[
        styles.panel,
        primary && styles.primary,
        collapsed && styles.collapsed,
        grain && GRAIN,
        id && ANCHOR,
        collapsed && COLLAPSED,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {damageTier !== undefined && damageVariant && !collapsed && <DamageOverlay tier={damageTier} variant={damageVariant} />}
      <div className={styles.body}>{children}</div>
    </section>
  );

  if (!collapseId) return body;
  return <CollapseContext.Provider value={{ collapsed, toggle: () => toggleCollapse(collapseId) }}>{body}</CollapseContext.Provider>;
}

export function PanelHeader({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  const collapse = useContext(CollapseContext);
  const heading = <h2 className={styles.heading}>{children}</h2>;

  return (
    <div className={`${HEADER} ${styles.header}`}>
      {collapse ? (
        <button type="button" className={`tap-inline ${styles.toggle}`} onClick={collapse.toggle} aria-expanded={!collapse.collapsed}>
          <span aria-hidden className={`${styles.chevron} ${collapse.collapsed ? styles.chevronCollapsed : ''}`}>
            ▾
          </span>
          {heading}
        </button>
      ) : (
        heading
      )}
      <div className={styles.rule} />
      {extra}
    </div>
  );
}
