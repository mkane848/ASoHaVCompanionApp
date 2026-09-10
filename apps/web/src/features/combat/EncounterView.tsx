import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Character,
  CharacterSheet,
  CharacterStatus,
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
  StatusSeverity,
  ToughnessTier,
} from '@asohav/shared';
import {
  addMotifPotential,
  advanceHealingTrack,
  downgradeStatuses,
  endTurn,
  firstToActFromInitiative,
  firstToActFromSurprise,
  isSubdued,
  markCondition,
  markEnemyStrain,
  markStrain,
  nextActor,
  isEnemyDefeated,
  newId,
  newParticipant,
  nowIso,
  rangeBandDistance,
  repelPushBandsForEnemy,
  repelPushBandsForStatuses,
  resistForcedMovementBands,
  resistRollReduction,
  shiftRange,
  startNewRound,
  statusAbsorb,
  statusSeverityCounts,
  takeStatus,
} from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { SectionHead } from '../../components/SectionHead.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { RecuperateModal } from '../sheet/RecuperateModal.js';
import { api } from '../../lib/api.js';
import { OwnPCCard, AllyPCCard, EnemyCard } from './ParticipantCard.js';
import { CombatMoveModal, type CombatMoveResult } from './CombatMoveModal.js';
import { AddParticipantModal } from './AddParticipantModal.js';
import styles from './EncounterView.module.css';

const RECUPERATE_SEGMENTS: Record<RollTier, number> = { Tier3: 3, Tier2: 2, Tier1: 1 };
const SEVERITIES: StatusSeverity[] = ['Minor', 'Major', 'Severe'];

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
  const [takingStatusOfferId, setTakingStatusOfferId] = useState<string | null>(null);
  const [offerStatusSeverity, setOfferStatusSeverity] = useState<StatusSeverity>('Minor');
  const [offerStatusName, setOfferStatusName] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resistingPush, setResistingPush] = useState(false);
  const [pushBandsInput, setPushBandsInput] = useState('');
  const [surprisedSide, setSurprisedSide] = useState<'Party' | 'Enemies' | ''>('');
  /** Self-serve, per-viewer: whether *this* player has already claimed the Combat-Goal Potential
   *  mark this Encounter. Not persisted on the Encounter itself — same trust model as everywhere
   *  else a player reports their own action — just a local guard against a double-click, since
   *  `encounter.CombatGoalAchieved` can stay true for the rest of the fight once set. */
  const [potentialClaimed, setPotentialClaimed] = useState(false);
  const [potentialMotifIndex, setPotentialMotifIndex] = useState<number | null>(null);
  /** A Crumble that happened inside this Encounter — only drives the notice telling the player
   *  to leave the scene and clear one Condition (they do the clearing on their own sheet, which
   *  is the only place that writes it). V0.6 slice 1 drops the old Vulnerable-4 grant this used
   *  to also apply (`applyCrumbleVulnerable` — V0.6 deletes that clause from Crumble entirely). */
  const [crumbledInCombat, setCrumbledInCombat] = useState(false);
  /** A Strain offer that left the target Subdued (see `isSubdued`) — Combat only points the
   *  player at their own sheet rather than duplicating anything here; V0.6 gives Subdued no
   *  further defined consequence (the old three-way Scar/Risk Death/Blaze of Glory choice
   *  retired with the rest of "Limits, Scars, & Death"). */
  const [subduedByOffer, setSubduedByOffer] = useState(false);

  const readOnly = archived;
  const slotCaps: Record<StatusSeverity, number> = {
    Minor: library.settings.MinorStatusSlots,
    Major: library.settings.MajorStatusSlots,
    Severe: library.settings.SevereStatusSlots,
  };

  const myParticipant = encounter.Participants.find((p) => p.Kind === 'PC' && p.RefId === myCharacterId);
  const partyParticipants = encounter.Participants.filter((p) => p.Kind === 'PC');
  const enemyParticipants = encounter.Participants.filter((p) => p.Kind === 'Enemy');
  const livingEnemies = enemyParticipants.filter((p) => !p.Defeated);
  const livingParty = partyParticipants.filter((p) => !p.Defeated);
  const livingParticipants = [...livingParty, ...livingEnemies];
  const livingBosses = livingEnemies.filter((p) => p.IsBoss);
  const actingParticipant = encounter.Participants.find((p) => p.Id === encounter.ActingParticipantId);
  const pairedParticipant = encounter.Participants.find((p) => p.Id === encounter.PairedParticipantId);
  const myOffers = myParticipant ? encounter.PendingStrainOffers.filter((o) => o.TargetParticipantId === myParticipant.Id) : [];
  const interposableOffers = myParticipant
    ? encounter.PendingStrainOffers.filter((o) => {
        if (o.TargetParticipantId === myParticipant.Id) return false;
        const target = partyParticipants.find((p) => p.Id === o.TargetParticipantId);
        return !!target && rangeBandDistance(myParticipant.Range, target.Range) <= 2;
      })
    : [];
  const canOpportunityAttack = !!myParticipant && livingEnemies.some((e) => e.Range === 'Melee');
  const availableCharacters = characters.filter((c) => !partyParticipants.some((p) => p.RefId === c.Id));

  function pcStatusesFor(p: CombatParticipant): CharacterStatus[] {
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
      d.PendingStrainOffers = d.PendingStrainOffers.filter((o) => o.TargetParticipantId !== participant.Id);
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

  /** V0.6 Combat Loop step 4 (slice 3): declaring one side wholly surprised skips the initiative
   *  roll (step 5) entirely and sets `ActingSide` directly via `firstToActFromSurprise()`. The
   *  doc's further "at the GM's discretion" extra effects (a head-start round, fewer actions,
   *  Disadvantage) are open-ended GM narration, not something this function computes. */
  function declareSurprise() {
    if (!surprisedSide) return;
    const side = surprisedSide;
    commitEncounter((d) => {
      d.ActingSide = firstToActFromSurprise(side);
      log(`${side} surprised — ${d.ActingSide} acts first.`)(d);
    });
    setSurprisedSide('');
  }

  /** Combat Loop step 3 (slice 3): "When the Heroes achieve the Combat Goal... Each player marks
   *  Potential." Self-serve — only the viewer's own sheet can be written, same constraint as every
   *  other Combat mutation that touches a PC's own data. */
  function claimCombatGoalPotential(motifIndex: number) {
    commitSheet((d) => { addMotifPotential(d.Motifs[motifIndex], 1, library.settings.PotentialTrackLength); });
    setPotentialClaimed(true);
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

  /** Mechanical Gambit effects that reduce cleanly to the existing Strain/Boon/Bane/Range
   *  primitives are automated (Bolster is folded into the roll's own amount by the modal before
   *  this runs); Repel/Seize/Other are logged only — their exact effect is a table call, not
   *  something to guess a formula for (see combat.ts's GAMBITS doc comment). */
  function applyGambits(gambits: ChosenGambit[], actor: CombatParticipant, target: CombatParticipant | undefined) {
    if (gambits.length === 0) return;
    const markedVirtueIds = gambits.map((g) => g.ConditionVirtueId).filter((v): v is string => !!v);
    if (markedVirtueIds.length > 0) {
      let didCrumble = false;
      commitSheet((d) => {
        // Every Condition mark goes through markCondition, which is the only thing that decides
        // a Crumble. Paying a Gambit's cost with all five already marked is exactly V0.5's
        // "you need to mark a Condition but all Conditions are already marked" trigger.
        for (const virtueId of markedVirtueIds) {
          if (markCondition(d, virtueId).Crumbled) didCrumble = true;
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
        // Gambits are only ever offered to a PC actor, and a PC's Engage target list is always
        // the opposing (Enemy) side — see CombatMoveModal's own doc comment — so `target` here is
        // always an Enemy in practice. Kept as a real branch rather than assumed, since Combat's
        // trust model lets the GM drive an Encounter into states the UI doesn't normally reach.
        const extraName = g.ExtraStatusName;
        if (target.Kind === 'Enemy') {
          commitEncounter((d) => {
            const t = d.Participants.find((x) => x.Id === target.Id);
            if (!t) return;
            t.Statuses = markEnemyStrain(t.Statuses ?? [], extraName, 2, library.settings.StrainTrackLength);
            // A Boss doesn't auto-drop at its Limit — Last Stand is a badge telling the GM it's
            // time to narrate the Boss's own bonus ability, not an instant defeat.
            if (isEnemyDefeated(t.Statuses, t.StatusLimits) && !t.IsBoss) t.Defeated = true;
          });
        } else {
          // No generalized cross-character Bane-offer mechanism exists yet (this app's own
          // documented limitation — see CLAUDE.md's "what's deliberately not built") — logged via
          // the general Gambit-usage line below rather than silently doing nothing.
          commitEncounter(log(`${actor.Name} tries to give ${target.Name} the ${extraName} Bane — no automated way to land it on another Hero yet; narrate it at the table.`));
        }
      } else if (g.Key === 'Repel' && target) {
        // V0.6 slice 1 / WorkPlan-V0.6.md Section B1: push bands equal to the severity of the
        // target's highest Status (Minor 1 / Major 2 / Severe 3) for a PC target, or the highest
        // value across its Strain tracks for an Enemy target — automated as of slice 5, still
        // reversing the 0.15.0 freeform-only decision (see combat.ts's doc comments). The Mettle
        // typed in here (if any) is the target's own Resist reduction, entered by whoever's
        // resolving the Gambit rather than a separate async round-trip.
        const bands = target.Kind === 'Enemy' ? repelPushBandsForEnemy(target.Statuses) : repelPushBandsForStatuses(pcStatusesFor(target));
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
        // B1: "+1 forward. Unchanged" — a temporary combat edge, the same shape Boons already
        // represent ("Boons and Banes function like temporary Statuses").
        commitSheet((d) => { d.Boons = [...d.Boons, 'Focused']; });
      } else if (g.Key === 'Brace') {
        // B1: "−1 Strain from everything until your next turn" — a real numeric reduction on
        // *incoming* hits, not an Advantage/Disadvantage-shaped Boon, so it can't reduce to the
        // same primitive Calculate does. This app has no timed-buff tracking (the same "Forward"
        // gap left freeform everywhere else — Clocks' losing-side spend menu, Consult the Past's
        // +1 Ongoing), so Brace stays logged-only, same treatment as Seize/Other: the table
        // applies the reduction by hand to whatever hits the Bracing actor before their next turn.
        commitEncounter(log(`${actor.Name} Braces — the table applies −1 Strain to anything that hits them before their next turn.`));
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
      t.Statuses = markEnemyStrain(t.Statuses ?? [], result.trackName, result.amount, library.settings.StrainTrackLength);
      if (isEnemyDefeated(t.Statuses, t.StatusLimits) && !t.IsBoss) t.Defeated = true;
      log(`${a?.Name ?? 'Someone'} deals ${t.Name} ${result.amount} Strain on ${result.trackName}${t.Defeated ? ' — defeated!' : '.'}`)(d);
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
      d.PendingStrainOffers.push({
        Id: newId('pso'),
        TargetParticipantId: result.targetId,
        Amount: result.amount,
        Note: `From ${a?.Name ?? 'an attacker'}'s ${kindLabel}`,
        Resistable: true,
      });
      log(`${a?.Name ?? 'Someone'} offers ${t?.Name ?? 'a target'} ${result.amount} Strain.`)(d);
    });
    applyGambits(result.gambits, actor, target);
    setEngaging(null);
  }

  /** Resolves an incoming Strain offer three ways (V0.6 slice 1 / Section B1): apply it in full,
   *  Resist (reduce it by a rolled Virtue), or take a Status instead (absorbing a flat 2/4/6 by
   *  severity). Whatever's left after either method lands on the Strain track. */
  function resolveOffer(offerId: string, reduction: number, takenStatus: { Severity: StatusSeverity; Name: string; Description: string } | null) {
    const offer = encounter.PendingStrainOffers.find((o) => o.Id === offerId);
    if (!offer) return;
    const finalAmount = Math.max(0, offer.Amount - reduction);
    let subdued = false;
    commitSheet((d) => {
      if (takenStatus) d.Statuses = takeStatus(d.Statuses, takenStatus);
      if (finalAmount > 0) d.Strain = markStrain(d.Strain, finalAmount, library.settings.StrainTrackLength);
      subdued = isSubdued(d.Strain, d.Statuses, slotCaps);
    });
    if (subdued) setSubduedByOffer(true);
    commitEncounter((d) => {
      d.PendingStrainOffers = d.PendingStrainOffers.filter((o) => o.Id !== offerId);
    });
    setResistingOfferId(null);
    setTakingStatusOfferId(null);
    setOfferStatusName('');
  }

  /** Interpose: swap into an ally's space (a real Range swap, not just a copy) and take their
   *  incoming Strain offer instead — the doc is explicit this can't be Resisted, so the offer is
   *  redirected with Resistable:false rather than removed and recreated. The interposer still
   *  resolves it themselves afterward, same as any other offer, from their own card. */
  function interpose(offerId: string) {
    if (!myParticipant) return;
    const interposerId = myParticipant.Id;
    const interposerName = myParticipant.Name;
    commitEncounter((d) => {
      const o = d.PendingStrainOffers.find((x) => x.Id === offerId);
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

  function recuperate(removeStatusId: string | null, tier: RollTier) {
    commitSheet((d) => {
      d.Strain = markStrain(d.Strain, 2, library.settings.StrainTrackLength);
      if (removeStatusId) d.Statuses = d.Statuses.filter((s) => s.Id !== removeStatusId);
      const length = library.settings.HealingTrackLength;
      const advanced = advanceHealingTrack(d.HealingTrack, RECUPERATE_SEGMENTS[tier], length);
      if (advanced >= length) {
        d.Statuses = downgradeStatuses(d.Statuses, slotCaps);
        d.HealingTrack = Math.max(0, advanced - length);
      } else {
        d.HealingTrack = advanced;
      }
    });
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

  const minorStatuses = (mySheet?.Statuses ?? []).filter((s) => s.Severity === 'Minor');
  const myFreeSlots: Record<StatusSeverity, boolean> = {
    Minor: statusSeverityCounts(mySheet?.Statuses ?? []).Minor < slotCaps.Minor,
    Major: statusSeverityCounts(mySheet?.Statuses ?? []).Major < slotCaps.Major,
    Severe: statusSeverityCounts(mySheet?.Statuses ?? []).Severe < slotCaps.Severe,
  };

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
              <label className={styles.initiativeLabel} htmlFor="surprised-side">
                Surprised side
              </label>
              <select
                id="surprised-side"
                className={styles.headerSelect}
                value={surprisedSide}
                onChange={(e) => setSurprisedSide(e.target.value as 'Party' | 'Enemies' | '')}
              >
                <option value="">Neither — roll initiative below</option>
                <option value="Party">Party</option>
                <option value="Enemies">Enemies</option>
              </select>
              <button className={`tap-inline ${styles.headerButton}`} disabled={!surprisedSide} onClick={declareSurprise}>
                Declare Surprise
              </button>
            </div>
            <p className={styles.note}>
              Surprise skips initiative — the other side acts first. Anything beyond that (a
              head-start round, fewer actions, Disadvantage for the surprised side) is the GM's
              own call at the table.
            </p>
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
              <button
                className={`tap-inline ${styles.headerButton} ${encounter.CombatGoalAchieved ? styles.headerButtonActive : ''}`}
                disabled={!encounter.CombatGoal.trim()}
                onClick={() => commitEncounter((d) => {
                  d.CombatGoalAchieved = !d.CombatGoalAchieved;
                  log(d.CombatGoalAchieved ? 'Combat Goal achieved — everyone may mark Potential.' : 'Combat Goal un-marked.')(d);
                })}
              >
                {encounter.CombatGoalAchieved ? 'Goal Achieved ✓' : 'Mark Goal Achieved'}
              </button>
            </div>
          </>
        )}
      </div>

      {encounter.CombatGoalAchieved && myParticipant && mySheet && !readOnly && (
        <div className={`${styles.section} ${styles.offer}`}>
          {potentialClaimed ? (
            <p className={styles.offerText}>Potential marked for achieving the Combat Goal.</p>
          ) : (
            <>
              <p className={styles.offerText}>
                <strong>Combat Goal achieved.</strong> Mark Potential on one of your Motifs.
              </p>
              <div className={styles.offerRow}>
                <select
                  className={styles.actionSelect}
                  value={potentialMotifIndex ?? ''}
                  onChange={(e) => setPotentialMotifIndex(e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">— pick a Motif —</option>
                  {mySheet.Motifs.map((m, i) => (
                    <option key={i} value={i}>
                      {m.Name || `Motif ${i + 1}`}
                    </option>
                  ))}
                </select>
                <button
                  className={`tap-inline ${styles.actionButton}`}
                  disabled={potentialMotifIndex === null}
                  onClick={() => { if (potentialMotifIndex !== null) claimCombatGoalPotential(potentialMotifIndex); }}
                >
                  Mark Potential
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {crumbledInCombat && (
        <div className={`${styles.section} ${styles.offer}`}>
          <p className={styles.offerText}>
            <strong>You Crumble.</strong> You had to mark a Condition with all five already marked.
            You can only act to flee or stay put. Say how you leave the scene, then clear one
            Condition on your sheet — and agree with the GM how and when you come back.
          </p>
          <button className={`tap-inline ${styles.actionButton}`} onClick={() => setCrumbledInCombat(false)}>
            Got it
          </button>
        </div>
      )}

      {subduedByOffer && (
        <div className={`${styles.section} ${styles.offer}`}>
          <p className={styles.offerText}>
            <strong>Subdued.</strong> No Strain box free, and no Status slot open to absorb the
            rest. Nothing further is automatic here — narrate what happens next at the table.
          </p>
          <button className={`tap-inline ${styles.actionButton}`} onClick={() => setSubduedByOffer(false)}>
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
                {o.Amount} Strain — {o.Note}
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
                  <button
                    className={`tap-inline ${styles.actionButton}`}
                    onClick={() => resolveOffer(o.Id, resistRollReduction(mySheet?.Virtues.find((v) => v.VirtueId === resistVirtue)?.Score ?? 0, resistTier), null)}
                  >
                    Apply Resisted
                  </button>
                </div>
              ) : takingStatusOfferId === o.Id ? (
                <div className={styles.offerRow}>
                  <select className={styles.actionSelect} value={offerStatusSeverity} onChange={(e) => setOfferStatusSeverity(e.target.value as StatusSeverity)}>
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s} disabled={!myFreeSlots[s]}>
                        {s} (absorbs {statusAbsorb(s)}){!myFreeSlots[s] ? ' — full' : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    className={styles.declareInput}
                    value={offerStatusName}
                    onChange={(e) => setOfferStatusName(e.target.value)}
                    placeholder="Status name"
                  />
                  <button
                    className={`tap-inline ${styles.actionButton}`}
                    disabled={!myFreeSlots[offerStatusSeverity] || !offerStatusName.trim()}
                    onClick={() => resolveOffer(o.Id, statusAbsorb(offerStatusSeverity), { Severity: offerStatusSeverity, Name: offerStatusName.trim(), Description: o.Note })}
                  >
                    Take it as a Status
                  </button>
                </div>
              ) : (
                <div className={styles.offerRow}>
                  <button className={`tap-inline ${styles.actionButton}`} onClick={() => resolveOffer(o.Id, 0, null)}>
                    Apply
                  </button>
                  {o.Resistable && (
                    <button className={`tap-inline ${styles.actionButton}`} onClick={() => setResistingOfferId(o.Id)}>
                      Resist first
                    </button>
                  )}
                  {o.Resistable && SEVERITIES.some((s) => myFreeSlots[s]) && (
                    <button className={`tap-inline ${styles.actionButton}`} onClick={() => setTakingStatusOfferId(o.Id)}>
                      Take a Status instead
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
                  {target?.Name ?? 'An ally'} is about to take {o.Amount} Strain.
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
              statuses={pcStatusesFor(p)}
              canRecuperate
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
              statuses={pcStatusesFor(p)}
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
            statuses={p.Statuses ?? []}
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
          onApplyToEnemy={applyToEnemy}
          onOfferToPC={offerToPC}
          onClose={() => setEngaging(null)}
        />
      )}

      {recuperating && mySheet && (
        <RecuperateModal
          minorStatuses={minorStatuses}
          mettleScore={mySheet.Virtues.find((v) => v.VirtueId === 'v-mettle')?.Score ?? 0}
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
