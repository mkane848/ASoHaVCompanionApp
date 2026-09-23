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
  advanceHealingTrack,
  downgradeStatuses,
  markCondition,
  markEnemyStrain,
  markStrain,
  isEnemyDefeated,
  newId,
  newParticipant,
  nowIso,
  repelPushBandsForEnemy,
  repelPushBandsForStatuses,
  resistForcedMovementBands,
  shiftRange,
  spendRapportForAid,
} from '@asohav/shared';
import { SectionHead } from '../../components/SectionHead.js';
import { RecuperateModal } from '../sheet/RecuperateModal.js';
import { api } from '../../lib/api.js';
import { OwnPCCard, AllyPCCard, EnemyCard } from './ParticipantCard.js';
import { CombatMoveModal, type CombatMoveResult } from './CombatMoveModal.js';
import { AddParticipantModal } from './AddParticipantModal.js';
import { EncounterHeader } from './EncounterHeader.js';
import { EndCombatConfirm, EndCombatFlow } from './EndCombatFlow.js';
import { IncomingOffers, InterposeSection } from './IncomingOffers.js';
import { ReactionsSection } from './ReactionsSection.js';
import { LegendarySection } from './LegendarySection.js';
import { DefiantGoals } from './DefiantGoals.js';
import { log } from './encounterLog.js';
import styles from './EncounterView.module.css';

const RECUPERATE_SEGMENTS: Record<RollTier, number> = { Tier3: 3, Tier2: 2, Tier1: 1 };

/** A live Encounter. This component keeps what more than one section needs — the Engage flow and
 *  its Gambits, Recuperate, Defend, Aid and the participant lists — and composes the rest from one
 *  component per section (header, end-of-combat, incoming offers, reactions, Interpose, Boss
 *  actions, Defiant Goals), each owning its own local state. */
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
  const qc = useQueryClient();
  const [engaging, setEngaging] = useState<{ actor: CombatParticipant; kind: EngageKind; free: boolean } | null>(null);
  const [recuperating, setRecuperating] = useState(false);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** A Crumble that happened inside this Encounter — only drives the notice telling the player
   *  to leave the scene and clear one Condition (they do the clearing on their own sheet, which
   *  is the only place that writes it). V0.6 slice 1 drops the old Vulnerable-4 grant this used
   *  to also apply (`applyCrumbleVulnerable` — V0.6 deletes that clause from Crumble entirely). */
  const [crumbledInCombat, setCrumbledInCombat] = useState(false);

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
  const canOpportunityAttack = !!myParticipant && livingEnemies.some((e) => e.Range === 'Melee');
  const availableCharacters = characters.filter((c) => !partyParticipants.some((p) => p.RefId === c.Id));

  function pcStatusesFor(p: CombatParticipant): CharacterStatus[] {
    if (p.RefId === myCharacterId) return mySheet?.Statuses ?? [];
    return peekSummaries[p.RefId]?.Statuses ?? [];
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
      spendRapportForAid(d, 1, library.settings.RapportTrackLength);
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

  return (
    <div>
      <EncounterHeader
        encounter={encounter}
        party={party}
        isGM={isGM}
        readOnly={readOnly}
        livingParticipants={livingParticipants}
        commitEncounter={commitEncounter}
        onRequestEnd={() => setConfirmingEnd(true)}
        onAddParticipant={() => setAddingParticipant(true)}
      />

      <EndCombatFlow encounter={encounter} library={library} myParticipant={myParticipant} mySheet={mySheet} readOnly={readOnly} commitSheet={commitSheet} />

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

      <IncomingOffers
        encounter={encounter}
        library={library}
        myParticipant={myParticipant}
        mySheet={mySheet}
        commitSheet={commitSheet}
        commitEncounter={commitEncounter}
      />

      <ReactionsSection
        myParticipant={myParticipant}
        mySheet={mySheet}
        canOpportunityAttack={canOpportunityAttack}
        readOnly={readOnly}
        commitEncounter={commitEncounter}
        onOpportunityAttack={() => setEngaging({ actor: myParticipant!, kind: 'Melee', free: true })}
      />

      <InterposeSection encounter={encounter} myParticipant={myParticipant} partyParticipants={partyParticipants} commitEncounter={commitEncounter} />

      <LegendarySection isGM={isGM} livingBosses={livingBosses} onBossActs={(b, kind) => setEngaging({ actor: b, kind, free: true })} />

      <DefiantGoals encounter={encounter} myParticipant={myParticipant} isGM={isGM} readOnly={readOnly} commitEncounter={commitEncounter} />

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
        <EndCombatConfirm onConfirm={() => { setConfirmingEnd(false); onEnd(); }} onCancel={() => setConfirmingEnd(false)} />
      )}
    </div>
  );
}
