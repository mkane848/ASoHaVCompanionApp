import { useState } from 'react';
import type { CharacterSheet, Library, Move, RollTier } from '@asohav/shared';
import { addMotifPotential, computeRollBreakdown, holdGrantForTier, markCondition } from '@asohav/shared';
import { InfoTooltip, TooltipSection } from '../../components/InfoTooltip.js';
import { CheckboxRow } from '../../components/form/CheckboxRow.js';
import { CrumbleModal } from './CrumbleModal.js';
import styles from './MoveRollHelper.module.css';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

const HOLD_TIER_LABELS: Record<RollTier, string> = { Tier3: '10+', Tier2: '7–9', Tier1: 'a miss' };
const HOLD_TIERS: RollTier[] = ['Tier3', 'Tier2', 'Tier1'];

interface FlatTag {
  motifIndex: number;
  motifName: string;
  tag: string;
  key: string;
}

/** Flattens all three Motifs' Skill/Flaw Tags into one list, each entry carrying which Motif it
 *  came from (for Flaw Tags' Potential mark) and a stable key (`motifIndex-tagIndex`, not the tag
 *  text itself, since two Motifs — or the same Motif — could hold the same text twice). */
function flattenTags(sheet: CharacterSheet, field: 'SkillTags' | 'FlawTags'): FlatTag[] {
  const out: FlatTag[] = [];
  sheet.Motifs.forEach((m, mi) => {
    m[field].forEach((tag, ti) => {
      if (tag.trim()) out.push({ motifIndex: mi, motifName: m.Name || `Motif ${mi + 1}`, tag, key: `${mi}-${ti}` });
    });
  });
  return out;
}

/** "What to roll" for a Basic Move — the real roll builder as of V0.6 slice 2 (`0.43.0`): 2d6 +
 *  Virtue, a declared Skill Tag and an optional Push Yourself second tag, any applicable Flaw
 *  Tags, the sheet's Status penalty, and a Boon/Bane comparison for Advantage/Disadvantage. This
 *  app never rolls the dice itself (see CLAUDE.md) — the player rolls physical dice against this
 *  total. Moves with no fixed Virtue ("Invoke Expertise", "Take a Risk") let the player pick which
 *  one fits the fictional action first. `commit` mutates the viewer's own sheet — Hold-grant
 *  reporting, Push Yourself's Condition mark, and a Flaw Tag's Potential mark all go through it,
 *  the same optimistic-commit path every other sheet mutation uses. */
export function MoveRollHelper({
  move,
  sheet,
  library,
  commit,
}: {
  move: Move;
  sheet: CharacterSheet;
  library: Library;
  commit: (mutator: (draft: CharacterSheet) => void) => void;
}) {
  const [pickedVirtueId, setPickedVirtueId] = useState<string | null>(null);
  const [grantedTier, setGrantedTier] = useState<RollTier | null>(null);
  const [skillTag, setSkillTag] = useState<string | null>(null);
  const [pushYourselfTag, setPushYourselfTag] = useState<string | null>(null);
  const [pushingVirtue, setPushingVirtue] = useState(false);
  const [usedFlawTagKeys, setUsedFlawTagKeys] = useState<Set<string>>(new Set());
  const [boonsSelected, setBoonsSelected] = useState<Set<number>>(new Set());
  const [banesSelected, setBanesSelected] = useState<Set<number>>(new Set());
  const [crumbling, setCrumbling] = useState(false);
  const virtueId = move.VirtueId ?? pickedVirtueId;

  if (!virtueId) {
    return (
      <div className={styles.rollHelper}>
        <div className={styles.label}>Roll 2d6 + which Virtue fits?</div>
        <div className={`tap-row ${styles.virtueRow}`}>
          {library.virtues.map((v) => (
            <button key={v.Id} type="button" className={`tap-inline ${styles.virtueButton}`} onClick={() => setPickedVirtueId(v.Id)}>
              {v.Name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const skillTags = flattenTags(sheet, 'SkillTags');
  const flawTags = flattenTags(sheet, 'FlawTags');
  const usedFlawTags = flawTags.filter((t) => usedFlawTagKeys.has(t.key)).map((t) => t.tag);
  const otherSkillTags = skillTags.filter((t) => t.tag !== skillTag);

  const breakdown = computeRollBreakdown(sheet, virtueId, library, {
    SkillTag: skillTag,
    PushYourselfTag: pushYourselfTag,
    FlawTags: usedFlawTags,
    BoonsSelected: boonsSelected.size,
    BanesSelected: banesSelected.size,
  });
  const holdTiers = HOLD_TIERS.filter((t) => holdGrantForTier(move, t) > 0);

  function grantHold(tier: RollTier) {
    const amount = holdGrantForTier(move, tier);
    if (amount <= 0) return;
    commit((d) => { d.Hold = (d.Hold ?? 0) + amount; });
    setGrantedTier(tier);
  }

  function chooseSkillTag(tag: string) {
    // Changing (or clearing) the declared tag drops any in-progress Push Yourself — "the other
    // tag" no longer makes sense once the declared one changes, and a Condition already marked
    // for a since-abandoned push stays marked (it isn't undone), same as every other one-way
    // Condition mark in this app.
    setSkillTag((cur) => (cur === tag ? null : tag));
    setPushYourselfTag(null);
    setPushingVirtue(false);
  }

  function beginPushYourself(tag: string) {
    setPushYourselfTag(tag);
    setPushingVirtue(true);
  }

  function markPushCondition(pushVirtueId: string) {
    let crumbled = false;
    commit((d) => { crumbled = markCondition(d, pushVirtueId).Crumbled; });
    setPushingVirtue(false);
    if (crumbled) setCrumbling(true);
  }

  function toggleFlawTag(t: FlatTag) {
    if (usedFlawTagKeys.has(t.key)) return; // one-way — Potential is already marked for this one
    setUsedFlawTagKeys((prev) => new Set(prev).add(t.key));
    commit((d) => { addMotifPotential(d.Motifs[t.motifIndex], 1, library.settings.PotentialTrackLength); });
  }

  function toggleBoon(i: number) {
    setBoonsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function toggleBane(i: number) {
    setBanesSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  return (
    <div className={styles.rollHelper}>
      <div className={styles.label}>
        Roll 2d6 + {breakdown.VirtueName}: <span className={styles.total}>{sign(breakdown.Total)}</span>
        {!move.VirtueId && (
          <button type="button" className={`tap-inline ${styles.change}`} onClick={() => setPickedVirtueId(null)}>
            change
          </button>
        )}
      </div>
      <ul className={styles.sources}>
        {breakdown.Sources.map((s, i) => (
          <li key={i}>
            {s.Label} <span className={styles.sourceValue}>{sign(s.Value)}</span>
          </li>
        ))}
      </ul>

      {skillTags.length > 0 && (
        <div className={styles.tagBlock}>
          <div className={styles.tagBlockLabel}>Skill Tags — declare one that applies (+1):</div>
          <div className={`tap-row ${styles.tagRow}`}>
            {skillTags.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`tap-inline ${styles.tagButton} ${skillTag === t.tag ? styles.tagButtonActive : ''}`}
                onClick={() => chooseSkillTag(t.tag)}
              >
                {t.tag} <span className={styles.tagMotif}>({t.motifName})</span>
              </button>
            ))}
          </div>
          {skillTag && !pushYourselfTag && otherSkillTags.length > 0 && (
            <div className={styles.pushBlock}>
              <div className={styles.tagBlockLabel}>Push Yourself — a second tag also applies (mark a Condition, +1):</div>
              <div className={`tap-row ${styles.tagRow}`}>
                {otherSkillTags.map((t) => (
                  <button key={t.key} type="button" className={`tap-inline ${styles.tagButton}`} onClick={() => beginPushYourself(t.tag)}>
                    {t.tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          {pushingVirtue && (
            <div className={styles.pushBlock}>
              <div className={styles.tagBlockLabel}>Mark which Condition?</div>
              <div className={`tap-row ${styles.virtueRow}`}>
                {library.virtues.map((v) => {
                  const cond = library.conditions.find((c) => c.VirtueId === v.Id);
                  return (
                    <button key={v.Id} type="button" className={`tap-inline ${styles.virtueButton}`} onClick={() => markPushCondition(v.Id)}>
                      {cond?.Name ?? v.Name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {pushYourselfTag && !pushingVirtue && (
            <div className={styles.holdConfirmed}>Pushed with &ldquo;{pushYourselfTag}&rdquo; — Condition marked.</div>
          )}
        </div>
      )}

      {flawTags.length > 0 && (
        <div className={styles.tagBlock}>
          <div className={styles.tagBlockLabel}>Flaw Tags that apply (−1 each, marks Potential either way):</div>
          {flawTags.map((t) => (
            <CheckboxRow key={t.key} checked={usedFlawTagKeys.has(t.key)} disabled={usedFlawTagKeys.has(t.key)} onToggle={() => toggleFlawTag(t)}>
              {t.tag} <span className={styles.tagMotif}>({t.motifName})</span>
            </CheckboxRow>
          ))}
        </div>
      )}

      {breakdown.StatusPenalty && (
        <div className={styles.statusEffects}>
          <div className={styles.statusEffectsLabel}>Also affecting this roll:</div>
          <ul className={styles.sources}>
            <li>
              {breakdown.StatusPenalty.Status.Name} ({breakdown.StatusPenalty.Status.Severity})
              <span className={styles.sourceValue}>{breakdown.StatusPenalty.Penalty.Label}</span>
            </li>
          </ul>
        </div>
      )}

      {holdTiers.length > 0 && (
        <div className={styles.holdBlock}>
          <div className={styles.holdLabel}>Hold this Move grants — report which tier you hit:</div>
          <div className={`tap-row ${styles.holdRow}`}>
            {holdTiers.map((t) => (
              <button
                key={t}
                type="button"
                className={`tap-inline ${styles.holdButton} ${grantedTier === t ? styles.holdButtonGranted : ''}`}
                onClick={() => grantHold(t)}
              >
                On {HOLD_TIER_LABELS[t]}: +{holdGrantForTier(move, t)} Hold
              </button>
            ))}
          </div>
          {grantedTier && <div className={styles.holdConfirmed}>Granted {holdGrantForTier(move, grantedTier)} Hold — now at {sheet.Hold ?? 0}.</div>}
        </div>
      )}

      <div className={styles.tagBlock}>
        <div className={styles.tagBlockLabel}>Boons &amp; Banes relevant to this roll:</div>
        {sheet.Boons.length === 0 && sheet.Banes.length === 0 ? (
          <div className={styles.holdConfirmed}>None yet — add some on the Statuses panel.</div>
        ) : (
          <div className={styles.boonBaneGrid}>
            <div>
              {sheet.Boons.map((b, i) => (
                <CheckboxRow key={i} checked={boonsSelected.has(i)} onToggle={() => toggleBoon(i)}>
                  {b}
                </CheckboxRow>
              ))}
            </div>
            <div>
              {sheet.Banes.map((b, i) => (
                <CheckboxRow key={i} checked={banesSelected.has(i)} onToggle={() => toggleBane(i)}>
                  {b}
                </CheckboxRow>
              ))}
            </div>
          </div>
        )}
        <div className={styles.advantageActiveBanner}>
          {breakdown.Advantage === 'Advantage' && 'More Boons than Banes — roll 3d6, keep the best two.'}
          {breakdown.Advantage === 'Disadvantage' && 'More Banes than Boons — roll 3d6, keep the worst two.'}
          {breakdown.Advantage === 'Normal' && 'Equal Boons and Banes (or none selected) — roll the usual 2d6.'}
        </div>
      </div>

      <div className={styles.advantageRow}>
        <span>Aid</span>
        <InfoTooltip label="Aid">
          <TooltipSection label="What it means">
            Any teammate can spend 1 Rapport to give you +1 on this roll — and they can do it
            <em> after</em> the dice land. Several teammates can stack Aid on the same roll, but each
            of them can only spend once on it. During Risk Death it costs double: 2 Rapport per +1.
          </TooltipSection>
          <TooltipSection label="How it works here">
            Spending happens on the Rapport track (Advancement panel, or a teammate's Combat card).
            This app can't see &ldquo;a roll,&rdquo; so it doesn't enforce the once-per-teammate
            limit or add the bonus to the total above — that stays with the table, same as
            Advantage. What it does track is the Rapport itself, and who spent it.
          </TooltipSection>
        </InfoTooltip>
      </div>

      {crumbling && (
        <CrumbleModal
          sheet={sheet}
          library={library}
          reason="Push Yourself needed a Condition marked with all five already marked."
          commit={commit}
          onClose={() => setCrumbling(false)}
        />
      )}
    </div>
  );
}
