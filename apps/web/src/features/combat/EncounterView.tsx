import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Character,
  CharacterSheet,
  CharacterSummary,
  ChosenGambit,
  CombatParticipant,
  EngageKind,
  Encounter,
  EnemyStatusLimit,
  EnemyTemplate,
  Library,
  Party,
  RollTier,
  ToughnessTier,
} from '@asohav/shared';
import {
  applyCrumbleVulnerable,
  endTurn,
  firstToActFromInitiative,
  giveStatus,
  healStatus,
  markCondition,
  nextActor,
  spendRecovery,
  isEnemyDefeated,
  newId,
  newParticipant,
  nowIso,
  rangeBandDistance,
  repelPushBands,
  resistForcedMovementBands,
  resistRollReduction,
  shiftRange,
  startNewRound,
} from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { SectionHead } from '../../components/SectionHead.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { HealStatusModal } from '../sheet/HealStatusModal.js';
import { api } from '../../lib/api.js';
import { OwnPCCard, AllyPCCard, EnemyCard } from './ParticipantCard.js';
import { CombatMoveModal, type CombatMoveResult } from './CombatMoveModal.js';
import { AddParticipantModal } from './AddParticipantModal.js';
import styles from './EncounterView.module.css';

export function EncounterView({
  encounter,
  library,
  characters,
  mySheet,
  myCharacterId,
  peekSummaries,
  party,
  isGM,
  archived,
  commitSheet,
  commitEncounter,
  commitParty,
  onEnd,
}: {
  encounter: Encounter;
  library: Library;
  characters: Character[];
  mySheet: CharacterSheet | null;
  myCharacterId: string | null;
  peekSummaries: Record<string, CharacterSummary>;
  party: Party;
  isGM: boolean;
  archived: boolean;
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  commitEncounter: (m: (d: Encounter) => void) => void;
  commitParty: (m: (d: Party) => void) => void;
  onEnd: () => void;
}) {
  const matcher = useGlossaryMatcher();
  const qc = useQueryClient();
  const [engaging, setEngaging] = useState<{ actor: CombatParticipant; kind: EngageKind; free: boolean } | null>(null);
  const [recuperating, setRecuperating] = useState(false);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [declareText, setDeclareText] = useState('');
  const [initiativeTotal, setInitiativeTotal] = useState('');
  const [resistingOfferId, setResistingOfferId] = useState<string | null>(null);
  const [resistVirtue, setResistVirtue] = useState('v-might');
  const [resistTier, setResistTier] = useState<RollTier>('Tier2');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resistingPush, setResistingPush] = useState(false);
  const [pushBandsInput, setPushBandsInput] = useState('');
  /** A Crumble that happened inside this Encounter — Vulnerable 4 has already been applied to the
   *  sheet; this only drives the notice telling the player to leave the scene and clear one
   *  Condition (they do the clearing on their own sheet, which is the only place that writes it). */
  const [crumbledInCombat, setCrumbledInCombat] = useState(false);
  /** A Status offer that landed on the Subdued box — the sheet owns the Scar/Risk Death choice,
   *  so Combat only points the player at it rather than duplicating that modal here. */
  const [subduedByOffer, setSubduedByOffer] = useState<string | null>(null);

  const readOnly = archived;
  /** The Virtue the Exhausted Condition hangs off — read from the library rather than hardcoding
   *  `'v-might'`, so retuning content doesn't silently break the Recoveries-0 rule. */
  const exhaustedVirtueId = library.conditions.find((c) => c.Id === 'c-exhausted')?.VirtueId ?? 'v-might';

  const myParticipant = encounter.Participants.find((p) => p.Kind === 'PC' && p.RefId === myCharacterId);
  const partyParticipants = encounter.Participants.filter((p) => p.Kind === 'PC');
  const enemyParticipants = encounter.Participants.filter((p) => p.Kind === 'Enemy');
  const livingEnemies = enemyParticipants.filter((p) => !p.Defeated);
  const livingParty = partyParticipants.filter((p) => !p.Defeated);
  const livingParticipants = [...livingParty, ...livingEnemies];
  const livingBosses = livingEnemies.filter((p) => p.IsBoss);
  const actingParticipant = encounter.Participants.find((p) => p.Id === encounter.ActingParticipantId);
  const pairedParticipant = encounter.Participants.find((p) => p.Id === encounter.PairedParticipantId);
  const myOffers = myParticipant ? encounter.PendingStatusOffers.filter((o) => o.TargetParticipantId === myParticipant.Id) : [];
  const interposableOffers = myParticipant
    ? encounter.PendingStatusOffers.filter((o) => {
        if (o.TargetParticipantId === myParticipant.Id) return false;
        const target = partyParticipants.find((p) => p.Id === o.TargetParticipantId);
        return !!target && rangeBandDistance(myParticipant.Range, target.Range) <= 2;
      })
    : [];
  const canOpportunityAttack = !!myParticipant && livingEnemies.some((e) => e.Range === 'Melee');
  const availableCharacters = characters.filter((c) => !partyParticipants.some((p) => p.RefId === c.Id));

  function statusesFor(p: CombatParticipant) {
    if (p.Kind === 'Enemy') return p.Statuses ?? [];
    if (p.RefId === myCharacterId) return mySheet?.Statuses ?? [];
    return peekSummaries[p.RefId]?.Statuses ?? [];
  }

  function log(text: string) {
    return (d: Encounter) => {
      d.History.unshift({ Id: newId('ch'), At: nowIso(), Text: text });
    };
  }

  function reposition(participant: CombatParticipant, delta: number) {
    commitEncounter((d) => {
      const p = d.Participants.find((x) => x.Id === participant.Id);
      if (!p || p.ActionPointsRemaining <= 0) return;
      p.Range = shiftRange(p.Range, delta);
      p.ActionPointsRemaining -= 1;
      log(`${p.Name} repositions to ${p.Range}.`)(d);
    });
  }

  function setAP(participant: CombatParticipant, n: number) {
    commitEncounter((d) => {
      const p = d.Participants.find((x) => x.Id === participant.Id);
      if (p) p.ActionPointsRemaining = n;
    });
  }

  function removeParticipant(participant: CombatParticipant) {
    commitEncounter((d) => {
      d.Participants = d.Participants.filter((x) => x.Id !== participant.Id);
      d.PendingStatusOffers = d.PendingStatusOffers.filter((o) => o.TargetParticipantId !== participant.Id);
    });
  }

  /** V0.5: AP recharges at the end of that Hero's own turn, not at the start of a new round.
   *  Ends the current actor's turn (and their paired partner's, if two Heroes moved together this
   *  turn) via `endTurn`, then suggests who logically goes next via `nextActor` — a default the GM
   *  can always override by picking a different participant from the selects above. */
  function endTurnAction() {
    if (!encounter.ActingParticipantId) return;
    commitEncounter((d) => {
      const actingId = d.ActingParticipantId!;
      const pairedId = d.PairedParticipantId;
      const actorName = d.Participants.find((p) => p.Id === actingId)?.Name ?? 'Someone';
      const partnerName = pairedId ? d.Participants.find((p) => p.Id === pairedId)?.Name : null;
      d.Participants = endTurn(d.Participants, actingId, pairedId);
      d.ActingSide = nextActor(d.Participants, d.ActingSide);
      d.ActingParticipantId = null;
      d.PairedParticipantId = null;
      log(`${actorName}${partnerName ? ` and ${partnerName}` : ''} end${partnerName ? '' : 's'} their turn.`)(d);
    });
  }

  /** Resist (V0.5's remaining unbuilt Reaction Move): reduce forced-movement distance by up to
   *  your own Mettle. Manually triggered and self-reported, same as everywhere else Combat asks
   *  "what happened at the table" rather than deriving it — there's no stored record of "you were
   *  just pushed N bands" to react to automatically. */
  function resistPush() {
    if (!myParticipant) return;
    const pushed = parseInt(pushBandsInput, 10);
    if (!Number.isFinite(pushed) || pushed <= 0) return;
    const mettle = mySheet?.Virtues.find((v) => v.VirtueId === 'v-mettle')?.Score ?? 0;
    const reduction = resistForcedMovementBands(pushed, mettle);
    commitEncounter((d) => {
      const p = d.Participants.find((x) => x.Id === myParticipant.Id);
      if (p) p.Range = shiftRange(p.Range, -reduction);
      log(`${myParticipant.Name} Resists, pulling back ${reduction} band${reduction === 1 ? '' : 's'}.`)(d);
    });
    setResistingPush(false);
    setPushBandsInput('');
  }

  /** Mechanical Gambit effects that reduce cleanly to the existing Status/Range primitives are
   *  automated (Bolster is folded into the roll's own Rank by the modal before this runs);
   *  Repel/Seize/Other are logged only — their exact effect is a table call, not something to
   *  guess a formula for (see combat.ts's GAMBITS doc comment). */
  function applyGambits(gambits: ChosenGambit[], actor: CombatParticipant, target: CombatParticipant | undefined) {
    if (gambits.length === 0) return;
    const markedVirtueIds = gambits.map((g) => g.ConditionVirtueId).filter((v): v is string => !!v);
    let didCrumble = false;
    if (markedVirtueIds.length > 0) {
      commitSheet((d) => {
        // Every Condition mark goes through markCondition, which is the only thing that decides
        // a Crumble. Paying a Gambit's cost with all five already marked is exactly V0.5's
        // "you need to mark a Condition but all Conditions are already marked" trigger.
        let crumbled = false;
        for (const virtueId of markedVirtueIds) {
          if (markCondition(d, virtueId).Crumbled) crumbled = true;
        }
        if (crumbled) {
          applyCrumbleVulnerable(d, library.settings.StatusMaxRank);
          didCrumble = true;
        }
      });
      if (didCrumble) setCrumbledInCombat(true);
    }
    for (const g of gambits) {
      if (g.Key === 'Press') {
        commitEncounter((d) => {
          const p = d.Participants.find((x) => x.Id === actor.Id);
          if (p) p.Range = shiftRange(p.Range, -2);
        });
      } else if ((g.Key === 'Halt' || g.Key === 'Impede') && target && g.ExtraStatusName) {
        const extraName = g.ExtraStatusName;
        if (target.Kind === 'Enemy') {
          commitEncounter((d) => {
            const t = d.Participants.find((x) => x.Id === target.Id);
            if (!t) return;
            const result = giveStatus(t.Statuses ?? [], { Name: extraName, Polarity: 'Negative', Rank: 2 }, library.settings.StatusMaxRank);
            t.Statuses = result.Statuses;
            // A Boss doesn't auto-drop at its Limit — Last Stand is a badge telling the GM it's
            // time to narrate the Boss's own bonus ability, not an instant defeat.
            if (isEnemyDefeated(t.Statuses, t.StatusLimits) && !t.IsBoss) t.Defeated = true;
          });
        } else {
          commitEncounter((d) => {
            d.PendingStatusOffers.push({ Id: newId('pso'), TargetParticipantId: target.Id, StatusName: extraName, Polarity: 'Negative', Rank: 2, Note: `From ${actor.Name}'s ${g.Key}`, Resistable: true });
          });
        }
      } else if (g.Key === 'Repel' && target) {
        // V0.5: push the target back a number of Range bands equal to its highest Negative
        // Status Rank — automated as of slice 5 (see combat.ts's repelPushBands doc comment for
        // why this reverses the 0.15.0 freeform-only decision). The Mettle typed in here (if any)
        // is the target's own Resist reduction, entered by whoever's resolving the Gambit rather
        // than a separate async round-trip — Range isn't ownership-gated the way Statuses are, so
        // there's no write this app can't already make in one step.
        const bands = repelPushBands(target.Kind === 'Enemy' ? target.Statuses : statusesFor(target));
        const mettle = g.ResistMettle ?? 0;
        const pushed = resistForcedMovementBands(bands, mettle);
        if (pushed > 0) {
          commitEncounter((d) => {
            const t = d.Participants.find((x) => x.Id === target.Id);
            if (t) t.Range = shiftRange(t.Range, pushed);
            log(`${target.Name} is Repelled ${pushed} band${pushed === 1 ? '' : 's'}${mettle ? ` (resisted from ${bands})` : ''}.`)(d);
          });
        }
      } else if (g.Key === 'Calculate') {
        commitSheet((d) => { d.Statuses = giveStatus(d.Statuses, { Name: 'Focused', Polarity: 'Positive', Rank: 1 }, library.settings.StatusMaxRank).Statuses; });
      } else if (g.Key === 'Brace') {
        commitSheet((d) => { d.Statuses = giveStatus(d.Statuses, { Name: 'Braced', Polarity: 'Positive', Rank: 1 }, library.settings.StatusMaxRank).Statuses; });
      }
    }
    commitEncounter(log(`${actor.Name} uses ${gambits.map((g) => g.Key).join(', ')}.`));
  }

  function applyToEnemy(result: CombatMoveResult) {
    if (!engaging) return;
    const { actor, free } = engaging;
    const target = livingEnemies.find((t) => t.Id === result.targetId);
    commitEncounter((d) => {
      const t = d.Participants.find((x) => x.Id === result.targetId);
      const a = d.Participants.find((x) => x.Id === actor.Id);
      if (a && !free) a.ActionPointsRemaining = Math.max(0, a.ActionPointsRemaining - 1);
      if (!t) return;
      const giveResult = giveStatus(t.Statuses ?? [], { Name: result.statusName, Polarity: 'Negative', Rank: result.rank }, library.settings.StatusMaxRank);
      t.Statuses = giveResult.Statuses;
      if (isEnemyDefeated(t.Statuses, t.StatusLimits) && !t.IsBoss) t.Defeated = true;
      log(`${a?.Name ?? 'Someone'} gives ${t.Name} ${result.statusName} ${result.rank}${t.Defeated ? ' — defeated!' : '.'}`)(d);
    });
    applyGambits(result.gambits, actor, target);
    setEngaging(null);
  }

  function offerToPC(result: CombatMoveResult) {
    if (!engaging) return;
    const { actor, kind, free } = engaging;
    const target = livingParty.find((t) => t.Id === result.targetId);
    const kindLabel = kind === 'Melee' ? 'Engage in Melee' : 'Engage at Range';
    commitEncounter((d) => {
      const a = d.Participants.find((x) => x.Id === actor.Id);
      const t = d.Participants.find((x) => x.Id === result.targetId);
      if (a && !free) a.ActionPointsRemaining = Math.max(0, a.ActionPointsRemaining - 1);
      d.PendingStatusOffers.push({
        Id: newId('pso'),
        TargetParticipantId: result.targetId,
        StatusName: result.statusName,
        Polarity: 'Negative',
        Rank: result.rank,
        Note: `From ${a?.Name ?? 'an attacker'}'s ${kindLabel}`,
        Resistable: true,
      });
      log(`${a?.Name ?? 'Someone'} offers ${t?.Name ?? 'a target'} ${result.statusName} ${result.rank}.`)(d);
    });
    applyGambits(result.gambits, actor, target);
    setEngaging(null);
  }

  function applyOffer(offerId: string, resisted: boolean) {
    const offer = encounter.PendingStatusOffers.find((o) => o.Id === offerId);
    if (!offer) return;
    const reduction = resisted ? resistRollReduction(mySheet?.Virtues.find((v) => v.VirtueId === resistVirtue)?.Score ?? 0, resistTier) : 0;
    const finalRank = Math.max(0, offer.Rank - reduction);
    if (finalRank > 0) {
      commitSheet((d) => {
        const result = giveStatus(d.Statuses, { Name: offer.StatusName, Polarity: offer.Polarity, Rank: finalRank }, library.settings.StatusMaxRank);
        d.Statuses = result.Statuses;
        // Surface Subdued here too. Before `0.28.0` this flag was discarded on the Combat path,
        // so a PC subdued by an enemy attack silently sat at the cap with no Scar/Risk Death
        // choice — only the sheet's own give-Status path ever ran the flow.
        if (result.Subdued) setSubduedByOffer(offer.StatusName);
      });
    }
    commitEncounter((d) => {
      d.PendingStatusOffers = d.PendingStatusOffers.filter((o) => o.Id !== offerId);
    });
    setResistingOfferId(null);
  }

  /** Interpose: swap into an ally's space (a real Range swap, not just a copy) and take their
   *  incoming Status offer instead — the doc is explicit this can't be Resisted, so the offer is
   *  redirected with Resistable:false rather than removed and recreated. The interposer still
   *  applies it themselves afterward, same as any other offer, from their own card. */
  function interpose(offerId: string) {
    if (!myParticipant) return;
    const interposerId = myParticipant.Id;
    const interposerName = myParticipant.Name;
    commitEncounter((d) => {
      const o = d.PendingStatusOffers.find((x) => x.Id === offerId);
      if (!o) return;
      const interposer = d.Participants.find((x) => x.Id === interposerId);
      const originalTarget = d.Participants.find((x) => x.Id === o.TargetParticipantId);
      if (interposer && originalTarget) {
        const swap = interposer.Range;
        interposer.Range = originalTarget.Range;
        originalTarget.Range = swap;
      }
      o.TargetParticipantId = interposerId;
      o.Resistable = false;
      log(`${interposerName} interposes for ${originalTarget?.Name ?? 'an ally'}.`)(d);
    });
  }

  function recuperate(statusId: string, amount: number) {
    let crumbledNow = false;
    commitSheet((d) => {
      d.Statuses = healStatus(d.Statuses, statusId, amount);
      // Spending the last Recovery gives the Exhausted Condition, which can itself Crumble you.
      const { Crumbled } = spendRecovery(d, exhaustedVirtueId);
      if (Crumbled) {
        applyCrumbleVulnerable(d, library.settings.StatusMaxRank);
        crumbledNow = true;
      }
    });
    if (crumbledNow) setCrumbledInCombat(true);
    if (myParticipant) {
      commitEncounter((d) => {
        const p = d.Participants.find((x) => x.Id === myParticipant.Id);
        if (p) p.ActionPointsRemaining = Math.max(0, p.ActionPointsRemaining - 1);
      });
    }
    setRecuperating(false);
  }

  function defend() {
    if (!myParticipant) return;
    commitSheet((d) => {
      const a = d.Armor.find((x) => !x.Used);
      if (a) a.Used = true;
    });
    commitEncounter((d) => {
      const p = d.Participants.find((x) => x.Id === myParticipant.Id);
      if (p) p.ActionPointsRemaining = Math.max(0, p.ActionPointsRemaining - 1);
      log(`${myParticipant.Name} defends, marking Armor.`)(d);
    });
  }

  /** Aid (V0.5): spend 1 Rapport for +1 on another Hero's roll, usable even after the dice are
   *  rolled. The app can't see "a roll", so it can't enforce the once-per-teammate limit — that
   *  stays a table rule, same as Advantage/Disadvantage. What it can do is move the currency and
   *  say who spent it and on whom. */
  function help(target: CombatParticipant) {
    if (party.Rapport <= 0) return;
    const helper = myParticipant?.Name ?? 'Someone';
    commitParty((d) => {
      d.Rapport = Math.max(0, d.Rapport - 1);
      d.History.unshift({
        Id: newId('h'),
        At: nowIso(),
        Action: 'spent',
        Name: 'Aid',
        Effect: `+1 to ${target.Name}'s roll`,
        By: helper,
      });
    });
    commitEncounter(log(`${helper} Aids ${target.Name}: +1 to their roll (−1 Rapport).`));
  }

  function addPC(character: Character) {
    commitEncounter((d) => {
      d.Participants.push(newParticipant({ Kind: 'PC', RefId: character.Id, Name: character.Name }));
    });
    setAddingParticipant(false);
  }

  function addEnemyFromTemplate(template: EnemyTemplate) {
    commitEncounter((d) => {
      d.Participants.push(
        newParticipant({
          Kind: 'Enemy',
          RefId: template.Id,
          Name: template.Name,
          Toughness: template.Toughness,
          StatusLimits: template.StatusLimits,
          IsBoss: template.IsBoss,
          GambitCharges: template.GambitCharges,
        }),
      );
    });
    setAddingParticipant(false);
  }

  function addAdhocEnemy(name: string, toughness: ToughnessTier, limits: EnemyStatusLimit[], isBoss: boolean, gambitCharges: number, saveToLibrary: boolean) {
    commitEncounter((d) => {
      d.Participants.push(
        newParticipant({ Kind: 'Enemy', RefId: '', Name: name, Toughness: toughness, StatusLimits: limits, IsBoss: isBoss, GambitCharges: gambitCharges }),
      );
    });
    if (saveToLibrary) {
      api.library
        .create('enemies', { Name: name, Description: '', IsBoss: isBoss, Toughness: toughness, StatusLimits: limits, GambitCharges: gambitCharges })
        .then(() => qc.invalidateQueries({ queryKey: ['library'] }))
        .catch((err) => console.error('enemy save failed', err));
    }
    setAddingParticipant(false);
  }

  function setGambitCharges(participant: CombatParticipant, n: number) {
    commitEncounter((d) => {
      const p = d.Participants.find((x) => x.Id === participant.Id);
      if (p) p.GambitCharges = Math.max(0, n);
    });
  }

  function markBossDefeated(participant: CombatParticipant) {
    commitEncounter((d) => {
      const p = d.Participants.find((x) => x.Id === participant.Id);
      if (p) p.Defeated = true;
      log(`${participant.Name}'s Last Stand ends — defeated.`)(d);
    });
  }

  return (
    <div>
      <div className={styles.header}>
        <h2 className={styles.goal}>
          {encounter.CombatGoal ? <GlossaryText text={encounter.CombatGoal} matcher={matcher} /> : 'No Combat Goal set.'}
        </h2>
        <div className={styles.statusRow}>
          <span>Round {encounter.Round}</span>
          <span>Acting: {encounter.ActingSide ?? 'Not rolled'}</span>
          <span>
            Current actor: {actingParticipant?.Name ?? 'None picked'}
            {pairedParticipant ? ` & ${pairedParticipant.Name}` : ''}
          </span>
        </div>
        {isGM && !readOnly && (
          <>
            <div className={`tap-row ${styles.initiativeRow}`}>
              <label className={styles.initiativeLabel} htmlFor="initiative-total">
                Initiative (2d6)
              </label>
              <input
                id="initiative-total"
                className={styles.initiativeInput}
                type="number"
                min={2}
                max={12}
                value={initiativeTotal}
                onChange={(e) => setInitiativeTotal(e.target.value)}
              />
              <button
                className={`tap-inline ${styles.headerButton}`}
                disabled={!initiativeTotal}
                onClick={() => {
                  commitEncounter((d) => { d.ActingSide = firstToActFromInitiative(parseInt(initiativeTotal, 10)); });
                  setInitiativeTotal('');
                }}
              >
                Roll Initiative
              </button>
            </div>
            <div className={`tap-row ${styles.initiativeRow}`}>
              <label className={styles.initiativeLabel} htmlFor="acting-participant">
                Current actor
              </label>
              <select
                id="acting-participant"
                className={styles.headerSelect}
                value={encounter.ActingParticipantId ?? ''}
                onChange={(e) => commitEncounter((d) => { d.ActingParticipantId = e.target.value || null; })}
              >
                <option value="">— pick who's acting —</option>
                {livingParticipants.map((p) => (
                  <option key={p.Id} value={p.Id}>
                    {p.Name} ({p.Kind === 'PC' ? 'Party' : 'Enemy'})
                  </option>
                ))}
              </select>
              <label className={styles.initiativeLabel} htmlFor="paired-participant">
                Acting together with
              </label>
              <select
                id="paired-participant"
                className={styles.headerSelect}
                value={encounter.PairedParticipantId ?? ''}
                disabled={!encounter.ActingParticipantId}
                onChange={(e) => commitEncounter((d) => { d.PairedParticipantId = e.target.value || null; })}
              >
                <option value="">No pairing</option>
                {livingParticipants
                  .filter((p) => p.Id !== encounter.ActingParticipantId)
                  .map((p) => (
                    <option key={p.Id} value={p.Id}>
                      {p.Name}
                    </option>
                  ))}
              </select>
            </div>
            <div className={`action-grid ${styles.actionsRow}`}>
              <button className={`tap-inline ${styles.headerButton}`} disabled={!encounter.ActingParticipantId} onClick={endTurnAction}>
                End Turn
              </button>
              <button
                className={`tap-inline ${styles.headerButton}`}
                onClick={() =>
                  commitEncounter((d) => {
                    d.Participants = startNewRound(d.Participants);
                    d.Round += 1;
                    d.ActingParticipantId = null;
                    d.PairedParticipantId = null;
                    log('New round.')(d);
                  })
                }
              >
                Next Round
              </button>
              <button className={`tap-inline ${styles.headerButton}`} onClick={() => setConfirmingEnd(true)}>
                End Combat
              </button>
              <button className={`tap-inline ${styles.headerButton}`} onClick={() => setAddingParticipant(true)}>
                Add Participant
              </button>
            </div>
          </>
        )}
      </div>

      {crumbledInCombat && (
        <div className={`${styles.section} ${styles.offer}`}>
          <p className={styles.offerText}>
            <strong>You Crumble.</strong> You had to mark a Condition with all five already marked.
            You take <em>Vulnerable 4</em>, and you can only act to flee or stay put. Say how you
            leave the scene, then clear one Condition on your sheet — and agree with the GM how and
            when you come back.
          </p>
          <button className={`tap-inline ${styles.actionButton}`} onClick={() => setCrumbledInCombat(false)}>
            Got it
          </button>
        </div>
      )}

      {subduedByOffer && (
        <div className={`${styles.section} ${styles.offer}`}>
          <p className={styles.offerText}>
            <strong>{subduedByOffer} reached the Subdued box.</strong> Open your character sheet to
            take a Scar, Risk Death, or go out in a Blaze of Glory — that choice lives on the sheet,
            where the Scar gets written.
          </p>
          <button className={`tap-inline ${styles.actionButton}`} onClick={() => setSubduedByOffer(null)}>
            Got it
          </button>
        </div>
      )}

      {myOffers.length > 0 && (
        <div className={styles.section}>
          <SectionHead title="Incoming" size="sm" />
          {myOffers.map((o) => (
            <div key={o.Id} className={styles.offer}>
              <div className={styles.offerText}>
                {o.StatusName} {o.Rank} — {o.Note}
              </div>
              {resistingOfferId === o.Id ? (
                <div className={styles.offerRow}>
                  <select className={styles.actionSelect} value={resistVirtue} onChange={(e) => setResistVirtue(e.target.value)}>
                    {library.virtues.map((v) => (
                      <option key={v.Id} value={v.Id}>
                        {v.Name}
                      </option>
                    ))}
                  </select>
                  <select className={styles.actionSelect} value={resistTier} onChange={(e) => setResistTier(e.target.value as RollTier)}>
                    <option value="Tier3">10+</option>
                    <option value="Tier2">7–9</option>
                    <option value="Tier1">Miss</option>
                  </select>
                  <button className={`tap-inline ${styles.actionButton}`} onClick={() => applyOffer(o.Id, true)}>
                    Apply Resisted
                  </button>
                </div>
              ) : (
                <div className={styles.offerRow}>
                  <button className={`tap-inline ${styles.actionButton}`} onClick={() => applyOffer(o.Id, false)}>
                    Apply
                  </button>
                  {o.Resistable && (
                    <button className={`tap-inline ${styles.actionButton}`} onClick={() => setResistingOfferId(o.Id)}>
                      Resist first
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(canOpportunityAttack || myParticipant) && !readOnly && (
        <div className={styles.section}>
          <SectionHead title="Reactions" size="sm" />
          {canOpportunityAttack && (
            <button
              className={`tap-inline ${styles.actionButton}`}
              onClick={() => setEngaging({ actor: myParticipant!, kind: 'Melee', free: true })}
            >
              Opportunity Attack
            </button>
          )}
          {myParticipant &&
            (resistingPush ? (
              <div className={styles.offerRow}>
                <input
                  className={styles.initiativeInput}
                  type="number"
                  min={1}
                  value={pushBandsInput}
                  onChange={(e) => setPushBandsInput(e.target.value)}
                  placeholder="Bands pushed"
                  aria-label="Bands pushed"
                />
                <button className={`tap-inline ${styles.actionButton}`} disabled={!pushBandsInput} onClick={resistPush}>
                  Resist (up to Mettle)
                </button>
                <button className={`tap-inline ${styles.actionButton}`} onClick={() => { setResistingPush(false); setPushBandsInput(''); }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className={`tap-inline ${styles.actionButton}`} onClick={() => setResistingPush(true)}>
                Resist a forced push
              </button>
            ))}
        </div>
      )}

      {interposableOffers.length > 0 && (
        <div className={styles.section}>
          <SectionHead title="Interpose" size="sm" />
          {interposableOffers.map((o) => {
            const target = partyParticipants.find((p) => p.Id === o.TargetParticipantId);
            return (
              <div key={o.Id} className={styles.offer}>
                <div className={styles.offerText}>
                  {target?.Name ?? 'An ally'} is about to take {o.StatusName} {o.Rank}.
                </div>
                <button className={`tap-inline ${styles.actionButton}`} onClick={() => interpose(o.Id)}>
                  Interpose
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isGM && livingBosses.length > 0 && (
        <div className={styles.section}>
          <SectionHead title="Boss actions" size="sm" />
          {livingBosses.map((b) => (
            <div key={b.Id} className={styles.offer}>
              <div className={styles.offerText}>
                {b.Name} — Gambit Charges: {b.GambitCharges ?? 0}
                {isEnemyDefeated(b.Statuses, b.StatusLimits) && ' — Last Stand'}
              </div>
              <div className={styles.offerRow}>
                <button className={`tap-inline ${styles.actionButton}`} onClick={() => setEngaging({ actor: b, kind: 'Melee', free: true })}>
                  Boss Acts (Melee)
                </button>
                <button className={`tap-inline ${styles.actionButton}`} onClick={() => setEngaging({ actor: b, kind: 'Ranged', free: true })}>
                  Boss Acts (Ranged)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.section}>
        <SectionHead title="Defiant Goals" size="sm" />
        {encounter.DefiantGoals.length === 0 && <p className={styles.empty}>None declared.</p>}
        {encounter.DefiantGoals.map((g) => {
          const owner = encounter.Participants.find((p) => p.Id === g.ParticipantId);
          return (
            <div key={g.Id} className={styles.goalItem}>
              <span className={g.Achieved ? styles.goalAchieved : ''}>
                {owner?.Name ?? 'Someone'}: <GlossaryText text={g.Text} matcher={matcher} />
              </span>
              {isGM && !readOnly && (
                <button
                  className={`tap-inline ${styles.lightButton}`}
                  onClick={() => commitEncounter((d) => { const found = d.DefiantGoals.find((x) => x.Id === g.Id); if (found) found.Achieved = !found.Achieved; })}
                >
                  {g.Achieved ? 'Unmark' : 'Mark Achieved'}
                </button>
              )}
            </div>
          );
        })}
        {myParticipant && !readOnly && (
          <div className={styles.declareRow}>
            <input className={styles.declareInput} value={declareText} onChange={(e) => setDeclareText(e.target.value)} placeholder="Declare your own Defiant Goal…" />
            <button
              className={`tap-inline ${styles.lightButton}`}
              disabled={!declareText.trim()}
              onClick={() => {
                commitEncounter((d) => { d.DefiantGoals.push({ Id: newId('dg'), ParticipantId: myParticipant.Id, Text: declareText.trim(), Achieved: false }); });
                setDeclareText('');
              }}
            >
              Declare
            </button>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <SectionHead title="Party" size="sm" />
        {partyParticipants.length === 0 && <p className={styles.empty}>No one from the party is in this fight.</p>}
        {partyParticipants.map((p) =>
          p.RefId === myCharacterId ? (
            <OwnPCCard
              key={p.Id}
              participant={p}
              statuses={statusesFor(p)}
              canRecuperate={(mySheet?.Recoveries ?? 0) > 0 && (mySheet?.Statuses.length ?? 0) > 0}
              canDefend={!!mySheet?.Armor.some((a) => !a.Used)}
              onSetAP={(n) => setAP(p, n)}
              onReposition={(delta) => reposition(p, delta)}
              onEngageMelee={() => setEngaging({ actor: p, kind: 'Melee', free: false })}
              onEngageRanged={() => setEngaging({ actor: p, kind: 'Ranged', free: false })}
              onRecuperate={() => setRecuperating(true)}
              onDefend={defend}
              onRemove={() => removeParticipant(p)}
            />
          ) : (
            <AllyPCCard
              key={p.Id}
              participant={p}
              statuses={statusesFor(p)}
              canControl={isGM}
              canHelp={!!myParticipant && party.Rapport > 0}
              onSetAP={(n) => setAP(p, n)}
              onReposition={(delta) => reposition(p, delta)}
              onHelp={() => help(p)}
              onRemove={() => removeParticipant(p)}
            />
          ),
        )}
      </div>

      <div className={styles.section}>
        <SectionHead title="Enemies" size="sm" />
        {enemyParticipants.length === 0 && <p className={styles.empty}>No enemies added.</p>}
        {enemyParticipants.map((p) => (
          <EnemyCard
            key={p.Id}
            participant={p}
            statuses={statusesFor(p)}
            canControl={isGM}
            onSetAP={(n) => setAP(p, n)}
            onReposition={(delta) => reposition(p, delta)}
            onEngageMelee={() => setEngaging({ actor: p, kind: 'Melee', free: false })}
            onEngageRanged={() => setEngaging({ actor: p, kind: 'Ranged', free: false })}
            onSetGambitCharges={(n) => setGambitCharges(p, n)}
            onMarkDefeated={() => markBossDefeated(p)}
            onRemove={() => removeParticipant(p)}
          />
        ))}
      </div>

      <div className={styles.section}>
        <SectionHead
          title="History"
          size="sm"
          extra={
            <button type="button" className={`tap-inline ${styles.lightButton}`} onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen}>
              {historyOpen ? 'Hide' : 'Show'} ({encounter.History.length})
            </button>
          }
        />
        {historyOpen &&
          (encounter.History.length === 0 ? (
            <p className={styles.empty}>Nothing logged yet.</p>
          ) : (
            <ul className={styles.historyList}>
              {encounter.History.map((h) => (
                <li key={h.Id} className={styles.historyItem}>
                  <span className={styles.historyTime}>{new Date(h.At).toLocaleTimeString()}</span>
                  <span>{h.Text}</span>
                </li>
              ))}
            </ul>
          ))}
      </div>

      {engaging && (
        <CombatMoveModal
          kind={engaging.kind}
          actor={engaging.actor}
          actorSheet={engaging.actor.RefId === myCharacterId ? mySheet : null}
          library={library}
          targets={engaging.actor.Kind === 'PC' ? livingEnemies : livingParty}
          targetStatuses={Object.fromEntries((engaging.actor.Kind === 'PC' ? livingEnemies : livingParty).map((t) => [t.Id, statusesFor(t)]))}
          onApplyToEnemy={applyToEnemy}
          onOfferToPC={offerToPC}
          onClose={() => setEngaging(null)}
        />
      )}

      {recuperating && mySheet && (
        <HealStatusModal
          statuses={mySheet.Statuses}
          mettleScore={mySheet.Virtues.find((v) => v.VirtueId === 'v-mettle')?.Score ?? 0}
          recoveries={mySheet.Recoveries ?? 0}
          onApply={recuperate}
          onClose={() => setRecuperating(false)}
        />
      )}

      {addingParticipant && (
        <AddParticipantModal
          library={library}
          availableCharacters={availableCharacters}
          onAddPC={addPC}
          onAddEnemyFromTemplate={addEnemyFromTemplate}
          onAddAdhocEnemy={addAdhocEnemy}
          onClose={() => setAddingParticipant(false)}
        />
      )}

      {confirmingEnd && (
        <ConfirmModal
          title="End Combat?"
          body="This closes the Encounter. Everyone should mark Potential on one of their Motifs if the Combat Goal was achieved — that's not automatic, since only a player can mark their own tracks."
          confirmLabel="End Combat"
          onConfirm={() => { setConfirmingEnd(false); onEnd(); }}
          onCancel={() => setConfirmingEnd(false)}
        />
      )}
    </div>
  );
}
