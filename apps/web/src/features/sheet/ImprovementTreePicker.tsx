import { useState } from 'react';
import type { Improvement, ImprovementCategory, Library } from '@asohav/shared';
import { improvementState } from '@asohav/shared';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './ImprovementTreePicker.module.css';

const CATEGORIES: ImprovementCategory[] = ['Combat', 'Narrative'];

/** The Hero Improvement Tree browser (slice 4) — 11 Combat + 14 Narrative trees, each a small
 *  prerequisite DAG (`improvementState` in `packages/shared/src/logic.ts`). Opened from
 *  `MotifPanel.tsx`'s "Gain a Hero Improvement" option once a Motif's Potential track clears.
 *  `heldIds` is the character's own held Improvement Ids — every tree shares one gate against the
 *  same set, since V0.5's rule (Ruleset-V0.5.md lines 458/489) checks Improvements a Hero
 *  already has, not which Motif earned the pick. */
export function ImprovementTreePicker({
  library,
  heldIds,
  onTake,
  onClose,
}: {
  library: Library;
  heldIds: Set<string>;
  onTake: (imp: Improvement) => void;
  onClose: () => void;
}) {
  const matcher = useGlossaryMatcher();
  const [openTreeId, setOpenTreeId] = useState<string | null>(null);
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby="improvement-picker-title" tabIndex={-1}>
        <div className={modal.head}>
          <h2 id="improvement-picker-title" className={modal.title}>Gain a Hero Improvement</h2>
          <p className={modal.subtitle}>
            Take a Starting Improvement on any tree, or one connected to an Improvement you already hold on that same tree. Each can only be chosen once.
          </p>
        </div>
        <div className={modal.body}>
          {CATEGORIES.map((category) => (
            <div key={category} className={styles.categoryGroup}>
              <div className={styles.categoryLabel}>{category} Trees</div>
              {library.improvementTrees.filter((t) => t.Category === category).map((tree) => {
                const nodes = library.improvements.filter((i) => i.TreeId === tree.Id);
                const heldCount = nodes.filter((n) => heldIds.has(n.Id)).length;
                const isOpen = openTreeId === tree.Id;
                return (
                  <div key={tree.Id} className={styles.tree}>
                    <button
                      type="button"
                      className={`tap-inline ${styles.treeHead}`}
                      aria-expanded={isOpen}
                      onClick={() => setOpenTreeId(isOpen ? null : tree.Id)}
                    >
                      <span className={styles.treeName}>{tree.Name}</span>
                      <span className={styles.treeMeta}>{heldCount > 0 ? `${heldCount} held · ` : ''}{nodes.length} node{nodes.length === 1 ? '' : 's'}</span>
                    </button>
                    {isOpen && (
                      <div className={styles.treeBody}>
                        <p className={styles.treeDescription}>{tree.Description}</p>
                        {nodes.map((node) => {
                          const state = improvementState(node, heldIds);
                          return (
                            <div key={node.Id} className={`${styles.node} ${state === 'locked' ? styles.nodeLocked : ''}`}>
                              <div className={styles.nodeHead}>
                                <span className={styles.nodeName}>{node.Name}</span>
                                {node.IsStarting && <span className={styles.badge}>starting</span>}
                                {state === 'held' && <span className={styles.badge}>held</span>}
                              </div>
                              <div className={styles.nodeEffect}><GlossaryText text={node.Effect} matcher={matcher} /></div>
                              {state === 'available' && (
                                <button type="button" className={`tap-inline ${modal.primaryAction} ${styles.takeButton}`} onClick={() => onTake(node)}>
                                  Take {node.Name}
                                </button>
                              )}
                              {state === 'locked' && <p className={styles.lockedHint}>Locked — hold a connected Improvement on this tree first.</p>}
                            </div>
                          );
                        })}
                        {nodes.length === 0 && <p className={styles.lockedHint}>No Improvements authored on this tree yet.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <button type="button" className={`tap-inline ${modal.secondaryAction} ${styles.dismiss}`} onClick={onClose}>
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}
