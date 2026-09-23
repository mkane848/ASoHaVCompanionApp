import { useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import type { CharacterSheet, Library, Party, RollModifierSource, PartyTagKind, RollShape } from '@asohav/shared';
import { addMotifPotential, computeRollBreakdown, conditionBaneCandidates, invokePartyTag, isPartyTagUsed, markCondition, partyTagKey, repeatedAttackShape, PartyTagUsedError } from '@asohav/shared';
import { CrumbleModal } from '../sheet/CrumbleModal.js';
import { flattenTags, type FlatTag } from './rollTags.js';
import { VirtuePicker, VirtueSection } from './VirtueSection.js';
import { SkillTagSection } from './SkillTagSection.js';
import { FlawTagSection } from './FlawTagSection.js';
import { ConditionBaneSection } from './ConditionBaneSection.js';
import { StatusSection } from './StatusSection.js';
import { BoonBaneSection } from './BoonBaneSection.js';
import { PartyTagSection } from './PartyTagSection.js';
import { AidSection } from './AidSection.js';
import { ReminderSection } from './ReminderSection.js';
import { OddsPanel } from './OddsPanel.js';
import { RollReportContext } from './rollReport.js';
import { useDebugMode } from '../../lib/useDebugMode.js';
import styles from './HeroRollBuilder.module.css';

/** Which roll is being built. A Move is the Moves drawer's roll; a Resist is the roll against
 *  incoming Strain; an Engage is Combat's attack roll (slice 6). Every one is a Hero Roll —
 *  the mode only decides which sections appear (`SECTIONS` below). */
export type HeroRollMode = 'Move' | 'Resist' | 'Engage';

type SectionKey = 'skillTags' | 'flawTags' | 'reminders' | 'conditionBanes' | 'status' | 'boonBane' | 'partyTags' | 'aid';

/** The section registry: what each mode shows, in order. A later slice adds a section by writing
 *  its component and listing its key here, not by changing the builder's props. */
const SECTIONS: Record<HeroRollMode, SectionKey[]> = {
  Move: ['skillTags', 'flawTags', 'reminders', 'conditionBanes', 'status', 'boonBane', 'partyTags', 'aid'],
  Resist: ['skillTags', 'flawTags', 'reminders', 'conditionBanes', 'status', 'boonBane', 'aid'],
  Engage: ['skillTags', 'flawTags', 'reminders', 'conditionBanes', 'status', 'boonBane', 'aid'],
};

export interface HeroRollBuilderProps {
  mode: HeroRollMode;
  /** The roll's fixed Virtue, or null to let the player pick one first. */
  virtueId: string | null;
  sheet: CharacterSheet;
  library: Library;
  /** Mutates the viewer's own sheet — Push Yourself's Condition mark and a Flaw Tag's Potential
   *  mark both go through it. */
  commit: (mutator: (draft: CharacterSheet) => void) => void;
  /** The Party Tags section needs all three; without them it doesn't render. */
  party?: Party;
  commitParty?: (mutator: (draft: Party) => void) => void;
  myName?: string;
  /** Numeric modifiers from outside the builder (Aid, a Bond spend, a reminder…), folded in before
   *  the cap. */
  extraModifiers?: RollModifierSource[];
  /** Banes from outside the sheet (a target's Cover, an Enemy's Virtue), counted in the same
   *  Boon/Bane comparison as the sheet's own. */
  extraBanes?: number;
  /** Boons from outside the sheet — exploiting an Enemy's Weak Virtue (slice 7). */
  extraBoons?: number;
  /** A roll made in Combat (slice 6): "During Combat, do *not* mark Potential each time a Skill or
   *  Flaw Tag is used" — Potential is marked once when Combat ends instead. A Flaw Tag still
   *  counts −1. */
  inCombat?: boolean;
  /** Repeated Attacks (slice 6): how many Strain-inflicting, AP-spending Moves this Hero has
   *  already made since their AP last refreshed. Each worsens the roll's shape one step after the
   *  Boon/Bane comparison (`repeatedAttackShape`). */
  priorStrainMoves?: number;
  /** Rendered after the sections once a Virtue is chosen — typically a `TierReport`, which tells
   *  the builder the tier was reported through `useRollReported()`. */
  children?: ReactNode;
  /** For a dialog that reports the tier outside the builder (a Resist, an Engage): call
   *  `tierReported()` when the player reports it, so a Forward applied to this roll is used up. */
  ref?: Ref<HeroRollBuilderHandle>;
}

export interface HeroRollBuilderHandle {
  tierReported: () => void;
}

/** "What to roll" for any Hero Roll: 2d6 + Virtue, a declared Skill Tag and an optional Push
 *  Yourself second tag, any applicable Flaw Tags, the sheet's Status penalty, and a Boon/Bane
 *  comparison for Advantage/Disadvantage. This app never rolls the dice itself (see CLAUDE.md) —
 *  the player rolls physical dice against this total. Extracted from `MoveRollHelper` (V0.6 slice
 *  2, `0.43.0`) so a Resist and an Engage build the same roll. */
export function HeroRollBuilder({
  mode,
  virtueId: fixedVirtueId,
  sheet,
  library,
  commit,
  party,
  commitParty,
  myName,
  extraModifiers,
  extraBanes = 0,
  extraBoons = 0,
  inCombat = false,
  priorStrainMoves = 0,
  children,
  ref,
}: HeroRollBuilderProps) {
  const [pickedVirtueId, setPickedVirtueId] = useState<string | null>(null);
  const [skillTag, setSkillTag] = useState<string | null>(null);
  const [pushYourselfTag, setPushYourselfTag] = useState<string | null>(null);
  const [pushingVirtue, setPushingVirtue] = useState(false);
  const [usedFlawTagKeys, setUsedFlawTagKeys] = useState<Set<string>>(new Set());
  const [boonsSelected, setBoonsSelected] = useState<Set<number>>(new Set());
  const [banesSelected, setBanesSelected] = useState<Set<number>>(new Set());
  const [conditionBaneOverrides, setConditionBaneOverrides] = useState<Map<string, boolean>>(new Map());
  const [invokedPartyTagKeys, setInvokedPartyTagKeys] = useState<Set<string>>(new Set());
  const [partyTagModifiers, setPartyTagModifiers] = useState<RollModifierSource[]>([]);
  const [crumbling, setCrumbling] = useState(false);
  const [appliedReminderIds, setAppliedReminderIds] = useState<Set<string>>(new Set());
  const debug = useDebugMode();
  const virtueId = fixedVirtueId ?? pickedVirtueId;

  /** A Forward "is used up when the tier is reported" (slice 9): drop every Forward applied to this
   *  roll from the sheet. An Ongoing one stays. */
  function tierReported() {
    const forwards = sheet.Reminders.filter((r) => r.Kind === 'Forward' && appliedReminderIds.has(r.Id)).map((r) => r.Id);
    if (forwards.length > 0) commit((d) => { d.Reminders = d.Reminders.filter((r) => !forwards.includes(r.Id)); });
    setAppliedReminderIds(new Set());
  }
  useImperativeHandle(ref, () => ({ tierReported }));

  if (!virtueId) return <VirtuePicker library={library} onPick={setPickedVirtueId} />;

  const conditionBanes = new Set(
    conditionBaneCandidates(sheet, library)
      .map((c) => c.VirtueId)
      .filter((id) => conditionBaneOverrides.get(id) ?? id === virtueId),
  );

  const skillTags = flattenTags(sheet, 'SkillTags');
  const flawTags = flattenTags(sheet, 'FlawTags');
  const usedFlawTags = flawTags.filter((t) => usedFlawTagKeys.has(t.key)).map((t) => t.tag);

  const breakdown = computeRollBreakdown(sheet, virtueId, library, {
    SkillTag: skillTag,
    PushYourselfTag: pushYourselfTag,
    FlawTags: usedFlawTags,
    BoonsSelected: boonsSelected.size + extraBoons,
    BanesSelected: banesSelected.size + conditionBanes.size + extraBanes,
    ExtraModifiers: [
      ...(extraModifiers ?? []),
      ...partyTagModifiers,
      ...sheet.Reminders.filter((r) => appliedReminderIds.has(r.Id)).map((r): RollModifierSource => ({ Kind: 'Reminder', Label: r.Text, Value: r.Value })),
    ],
  });

  const shape = priorStrainMoves > 0 ? repeatedAttackShape(breakdown.Advantage, priorStrainMoves) : breakdown.Advantage;
  // The odds readout's dice: a Severe Status rolls 1d6; a Major one's Disadvantage isn't combined
  // with the Boon/Bane shape (an open question — see `RollBreakdown.StatusPenalty`), only noted.
  const severity = breakdown.StatusPenalty?.Status.Severity;
  const oddsShape: RollShape = severity === 'Severe' ? 'OneDie' : shape;
  const oddsNote = severity === 'Major' ? 'A Major Status also gives Disadvantage; these odds leave it out.' : undefined;

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

  function markFlawTag(t: FlatTag) {
    if (inCombat) {
      // Nothing is marked in Combat, so the tick is an ordinary toggle.
      toggleIn(setUsedFlawTagKeys, t.key);
      return;
    }
    if (usedFlawTagKeys.has(t.key)) return; // one-way — Potential is already marked for this one
    setUsedFlawTagKeys((prev) => new Set(prev).add(t.key));
    commit((d) => { addMotifPotential(d.Motifs[t.motifIndex], 1, library.settings.PotentialTrackLength); });
  }

  function toggleIn<T>(set: (fn: (prev: Set<T>) => Set<T>) => void, value: T) {
    set((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  /** An override wins over the default (the rolled Virtue's own Condition pre-ticked), so the
   *  default keeps following the Virtue until the player touches that row. */
  function toggleConditionBane(virtueId: string) {
    const checked = conditionBanes.has(virtueId);
    setConditionBaneOverrides((prev) => new Map(prev).set(virtueId, !checked));
  }

  /** One-way, like every other tag declaration here. The used check runs against the party this
   *  builder was rendered with; the mutator re-checks against the latest copy and does nothing if
   *  another Hero used the tag in between (`PartyTagUsedError`). */
  function invokePartyTagOnRoll(kind: PartyTagKind, tag: string) {
    const key = partyTagKey(kind, tag);
    if (!party || !commitParty || invokedPartyTagKeys.has(key) || isPartyTagUsed(party, kind, tag)) return;
    setInvokedPartyTagKeys((prev) => new Set(prev).add(key));
    setPartyTagModifiers((prev) => [
      ...prev,
      { Kind: 'PartyTag', Label: `Party ${kind} Tag: ${tag}`, Value: kind === 'Skill' ? 1 : -1 },
    ]);
    commitParty((d) => {
      try {
        invokePartyTag(d, kind, tag, myName);
      } catch (e) {
        if (!(e instanceof PartyTagUsedError)) throw e;
      }
    });
  }

  function renderSection(key: SectionKey) {
    switch (key) {
      case 'skillTags':
        return (
          <SkillTagSection
            key={key}
            library={library}
            skillTags={skillTags}
            skillTag={skillTag}
            pushYourselfTag={pushYourselfTag}
            pushingVirtue={pushingVirtue}
            onChooseSkillTag={chooseSkillTag}
            onBeginPush={beginPushYourself}
            onMarkPushCondition={markPushCondition}
          />
        );
      case 'reminders':
        return (
          <ReminderSection
            key={key}
            reminders={sheet.Reminders}
            selected={appliedReminderIds}
            onToggle={(id) => toggleIn(setAppliedReminderIds, id)}
          />
        );
      case 'flawTags':
        return <FlawTagSection key={key} flawTags={flawTags} usedKeys={usedFlawTagKeys} marksPotential={!inCombat} onUse={markFlawTag} />;
      case 'conditionBanes':
        return (
          <ConditionBaneSection
            key={key}
            sheet={sheet}
            library={library}
            selected={conditionBanes}
            onToggle={toggleConditionBane}
          />
        );
      case 'status':
        return <StatusSection key={key} breakdown={breakdown} />;
      case 'boonBane':
        return (
          <BoonBaneSection
            key={key}
            sheet={sheet}
            boonsSelected={boonsSelected}
            banesSelected={banesSelected}
            advantage={shape}
            repeatedAttacks={priorStrainMoves > 0 ? { prior: priorStrainMoves, base: breakdown.Advantage } : undefined}
            onToggleBoon={(i) => toggleIn(setBoonsSelected, i)}
            onToggleBane={(i) => toggleIn(setBanesSelected, i)}
          />
        );
      case 'partyTags':
        return party && commitParty ? <PartyTagSection key={key} party={party} invokedKeys={invokedPartyTagKeys} onInvoke={invokePartyTagOnRoll} /> : null;
      case 'aid':
        return <AidSection key={key} />;
    }
  }

  return (
    <RollReportContext.Provider value={tierReported}>
      <div className={styles.rollHelper}>
        <VirtueSection breakdown={breakdown} onChange={fixedVirtueId ? undefined : () => setPickedVirtueId(null)} />
        {SECTIONS[mode].map(renderSection)}
        {debug && <OddsPanel modifier={breakdown.Total} shape={oddsShape} note={oddsNote} />}
        {children}
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
    </RollReportContext.Provider>
  );
}
