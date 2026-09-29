import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { completeQuest, abandonQuest, partyQuestHolder, writePartyQuestHolder, isPartyTagUsed, campActionsAllowed, campaignPhase, newId, nowIso, type QuestCompletionChoices, type QuestAbandonInput, type PartyQuestKind } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useCommitParty, useBondActions } from '../lib/mutations.js';
import { isPlaying } from '../lib/phaseLabels.js';
import { QuestProgress } from '../features/sheet/QuestProgress.js';
import { TagList } from '../components/TagList.js';
import { GlossaryText } from '../components/GlossaryText.js';
import { useGlossaryMatcher } from '../lib/useGlossaryMatcher.js';
import styles from './PartyPage.module.css';
import typography from '../styles/typography.module.css';

const QUEST_KIND_DESCRIPTIONS: Record<PartyQuestKind, string> = {
  Vision: 'A shared way the Party wants to change their world for the better.',
  Covenant: 'A binding vow, sacred duty, or shared ideology the Party will swear to uphold, spread, or enforce.',
  Shield: 'A realm, society, or vulnerable population the Party stands united to defend against an overwhelming threat.',
  Expedition: 'A grand mystery, uncharted frontier, or legendary truth that the Party is compelled to uncover.',
};

export default function PartyPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const commitParty = useCommitParty(campaignId);
  const bondActions = useBondActions(campaignId);
  const matcher = useGlossaryMatcher();
  /** "Write our own" is picked but not yet named — a fresh party also has no MotifId and no name,
   *  and that shouldn't read as a choice already made. */
  const [writingOwnMotif, setWritingOwnMotif] = useState(false);
  const [addingCustomImprovement, setAddingCustomImprovement] = useState(false);
  const [customImprovementName, setCustomImprovementName] = useState('');
  const [customImprovementEffect, setCustomImprovementEffect] = useState('');
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [selectedTagIndex, setSelectedTagIndex] = useState<number>(-1);
  const [customTag, setCustomTag] = useState('');
  /** A Connection Tag handshake request is on its way. Every Bond control waits on it: a Bond holds
   *  one pending change at a time, so a second tap before the first answers could only be refused
   *  or act on a proposal that's about to change. */
  const [bondRequestInFlight, setBondRequestInFlight] = useState(false);

  if (isLoading || libLoading || !boot || !library || !campaignId) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const { campaign, party } = boot;
  // This page is Party Creation's setup surface. During Signup there are no Heroes yet and the
  // table hasn't sat down to agree anything, so it reads exactly like an archived campaign: every
  // value visible, nothing editable. One flag, so a new control can't honour one and miss the other.
  const inSignup = campaignPhase(campaign) === 'Signup';
  const locked = campaign.Status === 'Archived' || inSignup;
  // Advancing, completing or abandoning the Party Quest spends and earns Rapport — play, not setup.
  // QuestProgress disables those controls via `playLocked`; the handlers refuse too, so a dialog
  // left open across a phase change can't commit one.
  const playing = isPlaying(campaign);

  function setMotif(motifId: string | null, motifName: string) {
    commitParty((d) => {
      d.MotifId = motifId;
      d.Motif = motifName;
    });
  }

  function setMotifName(name: string) {
    if (name === party.Motif) return;
    commitParty((d) => {
      d.Motif = name;
    });
  }

  function setSkillTags(tags: string[]) {
    commitParty((d) => {
      d.SkillTags = tags;
    });
  }

  function setFlawTags(tags: string[]) {
    commitParty((d) => {
      d.FlawTags = tags;
    });
  }

  function setQuestKind(kind: PartyQuestKind | null) {
    commitParty((d) => {
      d.QuestKind = kind;
    });
  }

  function setQuestText(quest: string) {
    commitParty((d) => {
      d.Quest = quest;
    });
  }

  function setActBreaks(n: number) {
    if (!playing) return;
    commitParty((d) => {
      d.ActBreaks = n;
    });
  }

  function setForsakes(n: number) {
    if (!playing) return;
    commitParty((d) => {
      d.Forsakes = n;
    });
  }

  function onQuestComplete(choices: QuestCompletionChoices) {
    if (!library || !playing) return;
    commitParty((d) => {
      const h = partyQuestHolder(d);
      const { fillProgress } = completeQuest(h, choices);
      writePartyQuestHolder(d, h);
      if (fillProgress) {
        d.Rapport = Math.max(d.Rapport, library.settings.RapportTrackLength);
      }
      d.History.push({
        Id: newId('he'),
        Action: 'noted',
        Name: 'Party Quest',
        Effect: 'Completed party quest',
        At: nowIso(),
      });
    });
  }

  function onQuestAbandon(input: QuestAbandonInput) {
    if (!playing) return;
    commitParty((d) => {
      const h = partyQuestHolder(d);
      const { progressToAdd } = abandonQuest(h, input);
      writePartyQuestHolder(d, h);
      d.MotifId = null;
      d.Rapport += progressToAdd;
      d.History.push({
        Id: newId('he'),
        Action: 'noted',
        Name: 'Party Quest',
        Effect: 'Abandoned party quest, gained Rapport',
        At: nowIso(),
      });
    });
  }

  function addImprovement(name: string, effect: string) {
    commitParty((d) => {
      d.RapportImprovementsTaken.push({
        Id: newId('ti'),
        Name: name.trim(),
        Effect: effect.trim(),
        TakenAt: nowIso(),
      });
    });
    setAddingCustomImprovement(false);
    setCustomImprovementName('');
    setCustomImprovementEffect('');
  }

  /** Awaits one Bond action and says whether it landed. The failure is already on screen —
   *  `useBondActions` toasts before rethrowing — so all this decides is whether a form may reset. */
  async function runBondAction(action: () => Promise<void>): Promise<boolean> {
    setBondRequestInFlight(true);
    try {
      await action();
      return true;
    } catch {
      return false;
    } finally {
      setBondRequestInFlight(false);
    }
  }

  async function proposeConnectionTag(bondId: string) {
    const landed = await runBondAction(() => bondActions.propose(bondId, 'SetConnectionTag', { Text: customTag.trim(), Delta: 0 }, 'Our Connection Tag.'));
    // A refused proposal keeps the form open exactly as typed, so trying again is one tap. It used
    // to reset before the request had even answered, reading as success either way.
    if (!landed) return;
    setEditingConnectionId(null);
    setSelectedTagIndex(-1);
    setCustomTag('');
  }

  const customMotif = party.MotifId === null && (writingOwnMotif || party.Motif !== '');
  const selectedQuestKind = party.QuestKind ?? null;
  const usedSkillTags = party.SkillTags.filter((tag) => isPartyTagUsed(party, 'Skill', tag));
  const usedFlawTags = party.FlawTags.filter((tag) => isPartyTagUsed(party, 'Flaw', tag));

  return (
    <div className={styles.page}>
      <Link to={`/c/${campaignId}`} className={styles.back}>
        &larr; {campaign.Name}
      </Link>
      <h1 className={styles.title}>The Party</h1>
      {inSignup && <p className={styles.lockedNote}>Party setup opens when the GM closes signup.</p>}

      {/* Party Motif Selection */}
      <section className={styles.section}>
        <div className={typography.label}>Party Motif</div>
        <p className={styles.hint}>Choose one of the archetypes, or write your own.</p>

        <div className={styles.motifCards}>
          {library.partyMotifs.map((motif) => (
            <button
              key={motif.Id}
              type="button"
              className={`${styles.motifCard} ${party.MotifId === motif.Id ? styles.selected : ''}`}
              onClick={() => { setWritingOwnMotif(false); setMotif(motif.Id, motif.Name); }}
              aria-pressed={party.MotifId === motif.Id}
              disabled={locked}
            >
              <div className={styles.motifCardName}>{motif.Name}</div>
              <div className={styles.motifCardDescription}>{motif.Description}</div>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.motifCard} ${customMotif ? styles.selected : ''}`}
            onClick={() => { setWritingOwnMotif(true); if (party.MotifId !== null) setMotif(null, ''); }}
            aria-pressed={customMotif}
            disabled={locked}
          >
            <div className={styles.motifCardName}>Write our own</div>
          </button>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="party-motif-name">Party Motif name</label>
          <input
            id="party-motif-name"
            key={party.Motif}
            className={`tap-inline ${styles.fieldInput}`}
            defaultValue={party.Motif}
            placeholder="You may change the name to better match your group's flavor"
            onBlur={(e) => setMotifName(e.target.value.trim())}
            disabled={locked}
          />
        </div>
      </section>

      {/* Skill Tags and Flaw Tags */}
      <section className={styles.section}>
        <div className={styles.tagGroups}>
          <div className={styles.tagGroup}>
            <div className={typography.label}>Party Skill Tags</div>
            <p className={styles.tagHint}>Agree on two.</p>
            {locked ? (
              <p className={styles.tagHint}>{party.SkillTags.join(', ') || 'None.'}</p>
            ) : (
              <TagList
                items={party.SkillTags}
                onChange={setSkillTags}
                addLabel="+ Skill Tag"
                placeholder="Write a tag…"
                ariaPrefix="Party Skill Tag"
              />
            )}
            {usedSkillTags.length > 0 && (
              <div className={styles.usedTags}>
                <span className={styles.usedTagsLabel}>Used — refreshes at Make Camp:</span>
                <span className={styles.usedTagsList}>{usedSkillTags.join(', ')}</span>
              </div>
            )}
          </div>

          <div className={styles.tagGroup}>
            <div className={typography.label}>Party Flaw Tags</div>
            <p className={styles.tagHint}>Agree on two. The GM invokes these on a Hero Roll; invoking marks Rapport.</p>
            {locked ? (
              <p className={styles.tagHint}>{party.FlawTags.join(', ') || 'None.'}</p>
            ) : (
              <TagList
                items={party.FlawTags}
                onChange={setFlawTags}
                addLabel="+ Flaw Tag"
                placeholder="Write a tag…"
                ariaPrefix="Party Flaw Tag"
              />
            )}
            {usedFlawTags.length > 0 && (
              <div className={styles.usedTags}>
                <span className={styles.usedTagsLabel}>Used — refreshes at Make Camp:</span>
                <span className={styles.usedTagsList}>{usedFlawTags.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Connections — Establish Connection Tags */}
      <section className={styles.section}>
        <div className={typography.label}>Connections</div>
        <p className={styles.hint}>
          For each pair of Heroes, agree on a Connection Tag that describes the current standings of the relationship. Ensure each unique pair of Heroes has exactly one Connection Tag.
        </p>
        <p className={`${styles.hint} ${styles.quote}`}>
          &ldquo;Heroes should pick a Tag that gives their pair room to grow.&rdquo;
        </p>

        {boot.bonds.length === 0 ? (
          <p className={styles.hint}>No pairs yet — more Heroes will create Connection opportunities.</p>
        ) : (
          <div className={styles.connectionsList}>
            {boot.bonds.map((bond) => {
              const charA = boot.characters.find((c) => c.Id === bond.CharacterAId);
              const charB = boot.characters.find((c) => c.Id === bond.CharacterBId);
              const p = bond.PendingChange;
              const mineProposed = p && p.ProposedBy === boot.membership.CharacterId;
              const isEditing = editingConnectionId === bond.Id;

              return (
                <div key={bond.Id} className={styles.connectionItem}>
                  <div className={styles.connectionItemHead}>
                    <span className={styles.connectionItemNames}>
                      {charA?.Name ?? 'Unknown'} & {charB?.Name ?? 'Unknown'}
                    </span>
                    {bond.ConnectionTag ? (
                      <span className={styles.connectionItemTag}>{bond.ConnectionTag}</span>
                    ) : (
                      <span className={styles.hint}>Not agreed yet</span>
                    )}
                  </div>

                  {p?.Type === 'SetConnectionTag' ? (
                    <div className={styles.connectionPending}>
                      <div className={styles.connectionProposal}>
                        {mineProposed ? (
                          <>
                            <span>You proposed: "{p.Payload.Text}"</span>
                            {!locked && (
                              <button
                                type="button"
                                className={`tap-inline ${styles.withdrawBtn}`}
                                disabled={bondRequestInFlight}
                                onClick={() => runBondAction(() => bondActions.reject(bond.Id, true))}
                              >
                                Withdraw
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <span>{boot.characters.find((c) => c.Id === p.ProposedBy)?.Name ?? 'They'} proposed: "{p.Payload.Text}"</span>
                            {charA?.Id === boot.membership.CharacterId || charB?.Id === boot.membership.CharacterId ? (
                              !locked && (
                                <div className={`action-grid ${styles.actions}`}>
                                  <button
                                    type="button"
                                    className={`tap-inline ${styles.acceptBtn}`}
                                    disabled={bondRequestInFlight}
                                    onClick={() => runBondAction(() => bondActions.accept(bond.Id))}
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    className={`tap-inline ${styles.declineBtn}`}
                                    disabled={bondRequestInFlight}
                                    onClick={() => runBondAction(() => bondActions.reject(bond.Id, false))}
                                  >
                                    Decline
                                  </button>
                                </div>
                              )
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  ) : isEditing && (charA?.Id === boot.membership.CharacterId || charB?.Id === boot.membership.CharacterId) && !locked ? (
                    <div className={styles.connectionForm}>
                      <select
                        className={`tap-inline ${styles.tagSelect}`}
                        aria-label={`Connection Tag for ${charA?.Name ?? 'Unknown'} and ${charB?.Name ?? 'Unknown'}`}
                        value={selectedTagIndex}
                        onChange={(e) => {
                          const idx = parseInt(e.target.value, 10);
                          setSelectedTagIndex(idx);
                          if (idx >= 0 && idx < library.connectionTags.length) {
                            setCustomTag(library.connectionTags[idx].Name);
                          } else {
                            setCustomTag('');
                          }
                        }}
                      >
                        <option value="-1">— choose —</option>
                        {library.connectionTags.map((tag, i) => (
                          <option key={tag.Id} value={i}>
                            {tag.Name}
                          </option>
                        ))}
                        <option value={library.connectionTags.length}>Write our own…</option>
                      </select>
                      {selectedTagIndex === library.connectionTags.length && (
                        <input
                          type="text"
                          className={`tap-inline ${styles.customTagInput}`}
                          value={customTag}
                          onChange={(e) => setCustomTag(e.target.value)}
                          placeholder="Custom Connection Tag…"
                          aria-label="Your own Connection Tag"
                          maxLength={80}
                          autoFocus
                        />
                      )}
                      <div className={`action-grid ${styles.actions}`}>
                        <button
                          type="button"
                          className={`tap-inline ${styles.proposeBtn}`}
                          disabled={bondRequestInFlight || !customTag.trim()}
                          onClick={() => proposeConnectionTag(bond.Id)}
                        >
                          Propose
                        </button>
                        <button
                          type="button"
                          className={`tap-inline ${styles.cancelBtn}`}
                          onClick={() => {
                            setEditingConnectionId(null);
                            setSelectedTagIndex(-1);
                            setCustomTag('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : !bond.ConnectionTag &&
                    !p &&
                    (charA?.Id === boot.membership.CharacterId || charB?.Id === boot.membership.CharacterId) &&
                    !locked ? (
                    <button
                      type="button"
                      className={`tap-inline ${styles.agreeBtn}`}
                      onClick={() => {
                        setEditingConnectionId(bond.Id);
                        setSelectedTagIndex(-1);
                        setCustomTag('');
                      }}
                    >
                      Agree on a tag
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Party Quest */}
      <section className={styles.section}>
        <div className={typography.label}>Party Quest</div>
        <p className={styles.hint}>Choose one quest to take on as a group.</p>

        <div className={styles.questKindSelect}>
          <label className={styles.fieldLabel} htmlFor="party-quest-kind">Quest kind</label>
          <select
            id="party-quest-kind"
            className={`tap-inline ${styles.select}`}
            value={selectedQuestKind ?? ''}
            onChange={(e) => setQuestKind((e.target.value as PartyQuestKind) || null)}
            disabled={locked}
          >
            <option value="">— choose —</option>
            {(Object.keys(QUEST_KIND_DESCRIPTIONS) as PartyQuestKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
          {selectedQuestKind && <p className={styles.hint}>{QUEST_KIND_DESCRIPTIONS[selectedQuestKind]}</p>}
        </div>

        {party.QuestKind && (
          <QuestProgress
            quest={party.Quest}
            actBreaks={party.ActBreaks}
            forsakes={party.Forsakes}
            currentName={party.Motif || 'The Party'}
            skillTags={party.SkillTags}
            flawTags={party.FlawTags}
            progressLabel="Rapport"
            onQuestChange={setQuestText}
            onSetActBreaks={setActBreaks}
            onSetForsakes={setForsakes}
            onComplete={onQuestComplete}
            onAbandon={onQuestAbandon}
            readOnly={locked}
            playLocked={!playing}
          />
        )}
      </section>

      {/* Party Improvements */}
      <section className={styles.section}>
        <div className={typography.label}>Party Improvements</div>

        {party.RapportImprovementsTaken.length === 0 ? (
          <div>
            <p className={styles.hint}>Choose one Party Improvement.</p>
            {!addingCustomImprovement ? (
              <div className={styles.improvementCards}>
                {library.partyImprovements.map((imp) => (
                  <button
                    key={imp.Id}
                    type="button"
                    className={styles.improvementCard}
                    onClick={() => addImprovement(imp.Name, imp.Description)}
                    disabled={locked}
                  >
                    <div className={styles.improvementCardName}>{imp.Name}</div>
                    <div className={styles.improvementCardEffect}>{imp.Description}</div>
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.improvementCard}
                  onClick={() => setAddingCustomImprovement(true)}
                  disabled={locked}
                >
                  <div className={styles.improvementCardName}>Write your own</div>
                </button>
              </div>
            ) : (
              <div className={styles.customImprovementForm}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="party-improvement-name">Improvement name</label>
                  <input
                    id="party-improvement-name"
                    className={`tap-inline ${styles.fieldInput}`}
                    value={customImprovementName}
                    placeholder="Name of the improvement…"
                    onChange={(e) => setCustomImprovementName(e.target.value)}
                    disabled={locked}
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="party-improvement-effect">Improvement effect</label>
                  <textarea
                    id="party-improvement-effect"
                    className={`tap-inline ${styles.fieldTextarea}`}
                    value={customImprovementEffect}
                    placeholder="What does it do?…"
                    onChange={(e) => setCustomImprovementEffect(e.target.value)}
                    disabled={locked}
                  />
                </div>
                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={`tap-inline ${styles.confirmBtn}`}
                    onClick={() => {
                      if (customImprovementName.trim() && customImprovementEffect.trim()) {
                        addImprovement(customImprovementName, customImprovementEffect);
                      }
                    }}
                    disabled={locked || !customImprovementName.trim() || !customImprovementEffect.trim()}
                  >
                    Take this improvement
                  </button>
                  <button
                    type="button"
                    className={`tap-inline ${styles.cancelBtn}`}
                    onClick={() => {
                      setAddingCustomImprovement(false);
                      setCustomImprovementName('');
                      setCustomImprovementEffect('');
                    }}
                    disabled={locked}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className={styles.improvementsList}>
              {party.RapportImprovementsTaken.map((imp) => (
                <div key={imp.Id} className={styles.improvementItem}>
                  <div className={styles.improvementItemName}>{imp.Name}</div>
                  <div className={styles.improvementItemEffect}><GlossaryText text={imp.Effect} matcher={matcher} /></div>
                </div>
              ))}
            </div>
            <p className={styles.improvementsNote}>More improvements come through Progress the Party (during Camp).</p>
            <p className={styles.campActionsNote}>
              Each Hero may take <strong>{campActionsAllowed(party.RapportImprovementsTaken.length)}</strong> Camp Action(s) — one per Party Improvement.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
