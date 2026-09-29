import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';
import type { CharacterSheet } from '@asohav/shared';
import { usePanelCollapseStore } from '../../store/panelCollapseStore.js';
import { PLAY_LOCKED_HINT } from '../../lib/phaseLabels.js';
import styles from './Panel.module.css';

export type SheetCommit = (m: (d: CharacterSheet) => void) => void;

/** How a sheet panel writes: through the caller's `commit`, or not at all. `readOnly` is the GM's
 *  peek at a player's sheet (PeekSheetModal) — the same panels, so the popup can't drift from the
 *  sheet as it evolves, with every edit control swapped for a plain rendering of its value. A
 *  read-only caller has nothing to pass (the server 403s a GM's sheet save anyway), so `commit`
 *  is only required when the panel can write. `readOnly` may still be a plain boolean at a call
 *  site that also passes `commit`. */
export type SheetWriteProps =
  | { readOnly?: false; commit: SheetCommit }
  | { readOnly: true; commit?: SheetCommit };

const NO_COMMIT: SheetCommit = () => {};

/** The commit a panel actually writes through. A read-only panel gets a no-op even when its caller
 *  passed a real one, so "read-only never writes" holds by construction, not only because every
 *  control that could write happens not to render. */
export function sheetWriter(props: SheetWriteProps): SheetCommit {
  return props.readOnly === true ? NO_COMMIT : props.commit;
}

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
  localCollapse = false,
  primary,
  grain,
  children,
  style,
}: {
  id?: string;
  /** Enables folding, and is the key the open/closed state persists under. */
  collapseId?: string;
  /** Fold in this instance only, starting open, and never read or write the persisted store. The
   *  read-only panels in the GM's peek use it: they share their `collapseId`s with the player's
   *  own sheet, so a GM who also plays in another campaign on the same browser would otherwise
   *  open a peek with their own folded panels folded, and fold their own sheet from the peek. */
  localCollapse?: boolean;
  primary?: boolean;
  grain?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const collapsedMap = usePanelCollapseStore((s) => s.collapsed);
  const toggleCollapse = usePanelCollapseStore((s) => s.toggle);
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = !!collapseId && (localCollapse ? localCollapsed : !!collapsedMap[collapseId]);

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
      {/* layout.css's `.panel-collapsed > div > *:not(.panel-header)` depends on this
          wrapper div's plain presence to hide a folded panel's body — keep it even
          though it carries no class/styling of its own. */}
      <div>{children}</div>
    </section>
  );

  if (!collapseId) return body;
  const toggle = localCollapse ? () => setLocalCollapsed((v) => !v) : () => toggleCollapse(collapseId);
  return <CollapseContext.Provider value={{ collapsed, toggle }}>{body}</CollapseContext.Provider>;
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

/** The one line a panel shows beside its play actions before the GM starts play (decisions.md
 *  item 63) — once per panel, not under every disabled control, which on the Statuses panel alone
 *  would repeat the same sentence a dozen times. The controls themselves stay visible, disabled,
 *  so a player can see what play will open up. */
export function PlayLockedNote() {
  return <p className={styles.lockedNote}>{PLAY_LOCKED_HINT}</p>;
}

/** `TagList`'s chips with no add, edit or remove: a read-only panel's rendering of the same values,
 *  and a locked one's (Boons and Banes before play). Composes TagList's own chip classes rather than
 *  restating them, so the two stay the same chip. `lockedAddLabel` keeps the add control in the
 *  flow, disabled, for a list that is only locked for now rather than read-only. */
export function StaticTags({
  items,
  emptyText,
  boardClassName = '',
  chipClassName = '',
  lockedAddLabel,
}: {
  items: string[];
  emptyText?: string;
  boardClassName?: string;
  chipClassName?: string;
  lockedAddLabel?: string;
}) {
  return (
    <div className={`${boardClassName} ${styles.chips}`}>
      {items.length === 0 && emptyText && <span className={styles.chipsEmpty}>{emptyText}</span>}
      {items.map((tag, i) => (
        <span key={`${i}:${tag}`} className={`${styles.chip} ${chipClassName}`} title={tag}>
          {tag}
        </span>
      ))}
      {lockedAddLabel && (
        <button type="button" className={`tap-inline ${styles.chipAdd}`} disabled>
          {lockedAddLabel}
        </button>
      )}
    </div>
  );
}
