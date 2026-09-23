import { useState } from 'react';
import type { Character, EnemyProfile, EnemyStatBlock, Library } from '@asohav/shared';
import {
  defaultStatBlock,
  ENEMY_PROFILE_DEFAULTS,
  encounterDifficulty,
} from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { Field } from '../../components/form/Field.js';
import { TextInput } from '../../components/form/TextInput.js';
import { Select } from '../../components/form/Select.js';
import { NumberInput } from '../../components/form/NumberInput.js';
import fieldStyles from '../../components/form/field.module.css';
import modal from '../../styles/modal.module.css';
import styles from './AddParticipantModal.module.css';

type Tab = 'heroes' | 'enemies' | 'villains' | 'npcs' | 'adhoc';

/** Tab-specific state: library selection, minion count, etc. */
interface TabState {
  selectedId: string;
  minionCount: number;
  saveToLibrary: boolean;
}

/**
 * Modal to add a participant to combat: a Hero character from the party, or an enemy (from the
 * library or ad-hoc). Replaced the old Toughness/StatusLimits/IsBoss fields with the V0.6 revised
 * stat block (profile-based Threat and Guard). Five tabs: Heroes, Enemies, Villains, NPCs, Ad-hoc.
 * Shows encounter difficulty for every enemy tab (current and with the candidate).
 */
export function AddParticipantModal({
  library,
  availableCharacters,
  heroCount,
  enemyThreats,
  onAddPC,
  onAddEnemy,
  onClose,
}: {
  library: Library;
  availableCharacters: Character[];
  /** Heroes already in the fight — the divisor for encounter difficulty. */
  heroCount: number;
  /** The Threat of every enemy already in the fight (a Minion group already multiplied by its size). */
  enemyThreats: number[];
  onAddPC: (character: Character) => void;
  onAddEnemy: (
    input: { RefId: string; Name: string; Stats: EnemyStatBlock; MinionCount?: number },
    saveToLibrary: boolean,
  ) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(availableCharacters.length > 0 ? 'heroes' : 'enemies');

  // Per-tab state for library selections
  const [enemiesState, setEnemiesState] = useState<TabState>({
    selectedId: library.enemies[0]?.Id ?? '',
    minionCount: 3,
    saveToLibrary: false,
  });
  const [villainsState, setVillainsState] = useState<TabState>({
    selectedId: library.villains[0]?.Id ?? '',
    minionCount: 3,
    saveToLibrary: false,
  });
  const [npcsState, setNpcsState] = useState<TabState>({
    selectedId: library.npcs[0]?.Id ?? '',
    minionCount: 3,
    saveToLibrary: false,
  });

  // Ad-hoc state
  const [adhocName, setAdhocName] = useState('');
  const [adhocProfile, setAdhocProfile] = useState<EnemyProfile>('Standard');
  const [adhocMinionCount, setAdhocMinionCount] = useState(3);
  const [adhocSaveToLibrary, setAdhocSaveToLibrary] = useState(false);

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  // Helper: get selected entry from a collection
  function getSelectedEntry<T extends { Id: string }>(
    collection: T[],
    selectedId: string,
  ): T | undefined {
    return collection.find((e) => e.Id === selectedId);
  }

  // Helper: compute threat for a given Stats block and minion count
  function getThreat(stats: EnemyStatBlock | undefined, minionCount: number = 1): number {
    if (!stats) return 0;
    return stats.Threat * minionCount;
  }

  // Helper: render stat block summary
  function renderStatBlockSummary(stats: EnemyStatBlock | undefined) {
    if (!stats) return <p className={styles.noStats}>No stat block</p>;

    const attackNames = stats.Attacks?.map((a) => a.Name).join(', ') || '(no attacks)';

    return (
      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Profile:</span>
          <span>{stats.Profile}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Threat:</span>
          <span>{stats.Threat}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Guard:</span>
          <span>{stats.Guard}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Strain:</span>
          <span>{stats.StrainBoxes} boxes</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Status slots:</span>
          <span>{stats.StatusSlots}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Attacks:</span>
          <span>{attackNames}</span>
        </div>
      </div>
    );
  }

  // Helper: render difficulty readout for an enemy tab
  function renderDifficultyReadout(candidateThreat: number) {
    const currentDiff = encounterDifficulty(enemyThreats, heroCount);
    const withCandidateDiff = encounterDifficulty([...enemyThreats, candidateThreat], heroCount);

    if (heroCount === 0) {
      return (
        <div className={styles.difficultyBox}>
          <p className={styles.difficultyText}>Add Heroes to see the difficulty.</p>
        </div>
      );
    }

    const currentBand = currentDiff.Band || 'Easy';
    const currentPerHero = currentDiff.ThreatPerHero?.toFixed(2) ?? '0.00';
    const withBand = withCandidateDiff.Band || 'Easy';
    const withPerHero = withCandidateDiff.ThreatPerHero?.toFixed(2) ?? '0.00';

    return (
      <div className={styles.difficultyBox}>
        <p className={styles.difficultyText}>
          Now: <strong>{currentBand}</strong> ({currentPerHero} Threat per Hero) · With this:{' '}
          <strong>{withBand}</strong> ({withPerHero})
        </p>
        <p className={styles.difficultyAdvice}>
          Keep non-Minion enemies at or below the number of Heroes unless that's deliberate.
        </p>
      </div>
    );
  }

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-participant-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="add-participant-title" className={modal.title}>
            Add to Combat
          </h2>
        </div>
        <div className={modal.body}>
          <div className={styles.tabs} role="tablist" aria-label="Add to Combat">
            <button
              type="button"
              id="add-participant-tab-heroes"
              role="tab"
              aria-selected={tab === 'heroes'}
              aria-controls="add-participant-panel-heroes"
              className={`tap-inline ${styles.tab} ${tab === 'heroes' ? styles.tabActive : ''}`}
              onClick={() => setTab('heroes')}
            >
              Heroes
            </button>
            <button
              type="button"
              id="add-participant-tab-enemies"
              role="tab"
              aria-selected={tab === 'enemies'}
              aria-controls="add-participant-panel-enemies"
              className={`tap-inline ${styles.tab} ${tab === 'enemies' ? styles.tabActive : ''}`}
              onClick={() => setTab('enemies')}
            >
              Enemies
            </button>
            <button
              type="button"
              id="add-participant-tab-villains"
              role="tab"
              aria-selected={tab === 'villains'}
              aria-controls="add-participant-panel-villains"
              className={`tap-inline ${styles.tab} ${tab === 'villains' ? styles.tabActive : ''}`}
              onClick={() => setTab('villains')}
            >
              Villains
            </button>
            <button
              type="button"
              id="add-participant-tab-npcs"
              role="tab"
              aria-selected={tab === 'npcs'}
              aria-controls="add-participant-panel-npcs"
              className={`tap-inline ${styles.tab} ${tab === 'npcs' ? styles.tabActive : ''}`}
              onClick={() => setTab('npcs')}
            >
              NPCs
            </button>
            <button
              type="button"
              id="add-participant-tab-adhoc"
              role="tab"
              aria-selected={tab === 'adhoc'}
              aria-controls="add-participant-panel-adhoc"
              className={`tap-inline ${styles.tab} ${tab === 'adhoc' ? styles.tabActive : ''}`}
              onClick={() => setTab('adhoc')}
            >
              Ad-hoc
            </button>
          </div>

          {/* Heroes tab */}
          {tab === 'heroes' && (
            <div
              role="tabpanel"
              id="add-participant-panel-heroes"
              aria-labelledby="add-participant-tab-heroes"
            >
              {availableCharacters.length === 0 ? (
                <p className={styles.empty}>Every character is already in this fight.</p>
              ) : (
                <>
                  <label className={fieldStyles.label} id="add-participant-heroes-label">
                    Which character?
                  </label>
                  <div role="group" aria-labelledby="add-participant-heroes-label">
                    {availableCharacters.map((c) => (
                      <button
                        key={c.Id}
                        type="button"
                        className={`tap-inline ${modal.secondaryAction}`}
                        onClick={() => onAddPC(c)}
                      >
                        {c.Name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Enemies tab */}
          {tab === 'enemies' && (
            <div
              role="tabpanel"
              id="add-participant-panel-enemies"
              aria-labelledby="add-participant-tab-enemies"
            >
              {renderDifficultyReadout(
                getThreat(
                  getSelectedEntry(library.enemies, enemiesState.selectedId)?.Stats,
                  enemiesState.minionCount,
                ),
              )}

              {library.enemies.length === 0 ? (
                <p className={styles.empty}>
                  No Enemies authored yet — add one in Content Admin, or use Ad-hoc.
                </p>
              ) : (
                <>
                  <Field label="Enemy" htmlFor="add-participant-enemies-select">
                    <Select
                      id="add-participant-enemies-select"
                      value={enemiesState.selectedId}
                      onChange={(e) =>
                        setEnemiesState((prev) => ({ ...prev, selectedId: e.target.value }))
                      }
                    >
                      {library.enemies.map((e) => {
                        const hasStats = !!e.Stats;
                        const profileLabel = hasStats && e.Stats ? ` (${e.Stats.Profile})` : '';
                        return (
                          <option key={e.Id} value={e.Id} disabled={!hasStats}>
                            {e.Name}
                            {hasStats ? profileLabel : ' — no stat block yet'}
                          </option>
                        );
                      })}
                    </Select>
                  </Field>

                  {(() => {
                    const entry = getSelectedEntry(library.enemies, enemiesState.selectedId);
                    const stats = entry?.Stats;
                    return (
                      <>
                        {renderStatBlockSummary(stats)}
                        {stats?.Profile === 'Minion' && (
                          <Field label="How many?" htmlFor="add-participant-enemies-minion">
                            <NumberInput
                              id="add-participant-enemies-minion"
                              min={1}
                              value={enemiesState.minionCount}
                              onChange={(e) =>
                                setEnemiesState((prev) => ({
                                  ...prev,
                                  minionCount: parseInt(e.target.value, 10) || 1,
                                }))
                              }
                            />
                          </Field>
                        )}

                        <button
                          className={`tap-inline ${modal.primaryAction}`}
                          disabled={!stats}
                          onClick={() => {
                            if (entry && stats) {
                              onAddEnemy(
                                {
                                  RefId: entry.Id,
                                  Name: entry.Name,
                                  Stats: stats,
                                  ...(stats.Profile === 'Minion' && {
                                    MinionCount: enemiesState.minionCount,
                                  }),
                                },
                                false,
                              );
                            }
                          }}
                        >
                          Add
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* Villains tab */}
          {tab === 'villains' && (
            <div
              role="tabpanel"
              id="add-participant-panel-villains"
              aria-labelledby="add-participant-tab-villains"
            >
              {renderDifficultyReadout(
                getThreat(
                  getSelectedEntry(library.villains, villainsState.selectedId)?.Stats,
                  villainsState.minionCount,
                ),
              )}

              {library.villains.length === 0 ? (
                <p className={styles.empty}>
                  No Villains authored yet — add one in Content Admin, or use Ad-hoc.
                </p>
              ) : (
                <>
                  <Field label="Villain" htmlFor="add-participant-villains-select">
                    <Select
                      id="add-participant-villains-select"
                      value={villainsState.selectedId}
                      onChange={(e) =>
                        setVillainsState((prev) => ({ ...prev, selectedId: e.target.value }))
                      }
                    >
                      {library.villains.map((v) => {
                        const hasStats = !!v.Stats;
                        const profileLabel = hasStats && v.Stats ? ` (${v.Stats.Profile})` : '';
                        return (
                          <option key={v.Id} value={v.Id} disabled={!hasStats}>
                            {v.Name}
                            {hasStats ? profileLabel : ' — no stat block yet'}
                          </option>
                        );
                      })}
                    </Select>
                  </Field>

                  {(() => {
                    const entry = getSelectedEntry(library.villains, villainsState.selectedId);
                    const stats = entry?.Stats;
                    return (
                      <>
                        {renderStatBlockSummary(stats)}
                        {stats?.Profile === 'Minion' && (
                          <Field label="How many?" htmlFor="add-participant-villains-minion">
                            <NumberInput
                              id="add-participant-villains-minion"
                              min={1}
                              value={villainsState.minionCount}
                              onChange={(e) =>
                                setVillainsState((prev) => ({
                                  ...prev,
                                  minionCount: parseInt(e.target.value, 10) || 1,
                                }))
                              }
                            />
                          </Field>
                        )}

                        <button
                          className={`tap-inline ${modal.primaryAction}`}
                          disabled={!stats}
                          onClick={() => {
                            if (entry && stats) {
                              onAddEnemy(
                                {
                                  RefId: entry.Id,
                                  Name: entry.Name,
                                  Stats: stats,
                                  ...(stats.Profile === 'Minion' && {
                                    MinionCount: villainsState.minionCount,
                                  }),
                                },
                                false,
                              );
                            }
                          }}
                        >
                          Add
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* NPCs tab */}
          {tab === 'npcs' && (
            <div
              role="tabpanel"
              id="add-participant-panel-npcs"
              aria-labelledby="add-participant-tab-npcs"
            >
              {renderDifficultyReadout(
                getThreat(
                  getSelectedEntry(library.npcs, npcsState.selectedId)?.Stats,
                  npcsState.minionCount,
                ),
              )}

              {library.npcs.length === 0 ? (
                <p className={styles.empty}>
                  No NPCs authored yet — add one in Content Admin, or use Ad-hoc.
                </p>
              ) : (
                <>
                  <Field label="NPC" htmlFor="add-participant-npcs-select">
                    <Select
                      id="add-participant-npcs-select"
                      value={npcsState.selectedId}
                      onChange={(e) =>
                        setNpcsState((prev) => ({ ...prev, selectedId: e.target.value }))
                      }
                    >
                      {library.npcs.map((npc) => {
                        const hasStats = !!npc.Stats;
                        const profileLabel = hasStats && npc.Stats ? ` (${npc.Stats.Profile})` : '';
                        return (
                          <option key={npc.Id} value={npc.Id} disabled={!hasStats}>
                            {npc.Name}
                            {hasStats ? profileLabel : ' — no stat block yet'}
                          </option>
                        );
                      })}
                    </Select>
                  </Field>

                  {(() => {
                    const entry = getSelectedEntry(library.npcs, npcsState.selectedId);
                    const stats = entry?.Stats;
                    return (
                      <>
                        {renderStatBlockSummary(stats)}
                        {stats?.Profile === 'Minion' && (
                          <Field label="How many?" htmlFor="add-participant-npcs-minion">
                            <NumberInput
                              id="add-participant-npcs-minion"
                              min={1}
                              value={npcsState.minionCount}
                              onChange={(e) =>
                                setNpcsState((prev) => ({
                                  ...prev,
                                  minionCount: parseInt(e.target.value, 10) || 1,
                                }))
                              }
                            />
                          </Field>
                        )}

                        <button
                          className={`tap-inline ${modal.primaryAction}`}
                          disabled={!stats}
                          onClick={() => {
                            if (entry && stats) {
                              onAddEnemy(
                                {
                                  RefId: entry.Id,
                                  Name: entry.Name,
                                  Stats: stats,
                                  ...(stats.Profile === 'Minion' && {
                                    MinionCount: npcsState.minionCount,
                                  }),
                                },
                                false,
                              );
                            }
                          }}
                        >
                          Add
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* Ad-hoc tab */}
          {tab === 'adhoc' && (
            <div
              role="tabpanel"
              id="add-participant-panel-adhoc"
              aria-labelledby="add-participant-tab-adhoc"
            >
              {renderDifficultyReadout(
                getThreat(
                  defaultStatBlock(adhocProfile),
                  adhocProfile === 'Minion' ? adhocMinionCount : 1,
                ),
              )}

              <Field label="Name" htmlFor="add-participant-adhoc-name">
                <TextInput
                  id="add-participant-adhoc-name"
                  placeholder="Brigand, Cave Bear…"
                  autoFocus
                  value={adhocName}
                  onChange={(e) => setAdhocName(e.target.value)}
                />
              </Field>

              <Field label="Profile" htmlFor="add-participant-adhoc-profile">
                <Select
                  id="add-participant-adhoc-profile"
                  value={adhocProfile}
                  onChange={(e) => setAdhocProfile(e.target.value as EnemyProfile)}
                >
                  <option value="Minion">Minion</option>
                  <option value="Standard">Standard</option>
                  <option value="Elite">Elite</option>
                  <option value="Legendary">Legendary</option>
                </Select>
              </Field>

              {adhocProfile === 'Minion' && (
                <Field label="How many?" htmlFor="add-participant-adhoc-minion">
                  <NumberInput
                    id="add-participant-adhoc-minion"
                    min={1}
                    value={adhocMinionCount}
                    onChange={(e) =>
                      setAdhocMinionCount(parseInt(e.target.value, 10) || 1)
                    }
                  />
                </Field>
              )}

              <p className={styles.hint}>{ENEMY_PROFILE_DEFAULTS[adhocProfile].Turn}</p>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={adhocSaveToLibrary}
                  onChange={(e) => setAdhocSaveToLibrary(e.target.checked)}
                  aria-label="Save this enemy to the Enemies library for reuse"
                />
                Save to the Enemies library
              </label>

              <button
                className={`tap-inline ${modal.primaryAction}`}
                disabled={!adhocName.trim()}
                onClick={() => {
                  onAddEnemy(
                    {
                      RefId: '',
                      Name: adhocName.trim(),
                      Stats: defaultStatBlock(adhocProfile),
                      ...(adhocProfile === 'Minion' && { MinionCount: adhocMinionCount }),
                    },
                    adhocSaveToLibrary,
                  );
                }}
              >
                Add
              </button>
            </div>
          )}

          <button className={`tap-inline ${modal.secondaryAction} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
