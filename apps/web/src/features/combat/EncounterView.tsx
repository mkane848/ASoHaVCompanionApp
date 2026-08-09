import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Character,
  CharacterSheet,
  CharacterSummary,
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
  firstToActFromInitiative,
  giveStatus,
  healStatus,
  isEnemyDefeated,
  newId,
  newParticipant,
  nowIso,
  resistRollReduction,
  shiftRange,
  startNewRound,
} from '@asohav/shared';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { HealStatusModal } from '../sheet/HealStatusModal.js';
import { api } from '../../lib/api.js';
import { ParticipantCard } from './ParticipantCard.js';
import { CombatMoveModal } from './CombatMoveModal.js';
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
  const [engaging, setEngaging] = useState<{ actor: CombatParticipant; kind: EngageKind } | null>(null);
  const [recuperating, setRecuperating] = useState(false);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [declareText, setDeclareText] = useState('');
  const [initiativeTotal, setInitiativeTotal] = useState('');
  const [resistingOfferId, setResistingOfferId] = useState<string | null>(null);
  const [resistVirtue, setResistVirtue] = useState('v-might');
  const [resistTier, setResistTier] = useState<RollTier>('Tier2');

  const readOnly = archived;
  const myParticipant = encounter.Participants.find((p) => p.Kind === 'PC' && p.RefId === myCharacterId);
  const partyParticipants = encounter.Participants.filter((p) => p.Kind === 'PC');
  const enemyParticipants = encounter.Participants.filter((p) => p.Kind === 'Enemy');
  const livingEnemies = enemyParticipants.filter((p) => !p.Defeated);
  const livingParty = partyParticipants.filter((p) => !p.Defeated);
  const myOffers = myParticipant ? encounter.PendingStatusOffers.filter((o) => o.TargetParticipantId === myParticipant.Id) : [];
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

  function applyToEnemy(targetId: string, rank: number, statusName: string) {
    if (!engaging) return;
    const actorId = engaging.actor.Id;
    commitEncounter((d) => {
      const t = d.Participants.find((x) => x.Id === targetId);
      const a = d.Participants.find((x) => x.Id === actorId);
      if (a) a.ActionPointsRemaining = Math.max(0, a.ActionPointsRemaining - 1);
      if (!t) return;
      const result = giveStatus(t.Statuses ?? [], { Name: statusName, Polarity: 'Negative', Rank: rank }, library.settings.StatusMaxRank);
      t.Statuses = result.Statuses;
      if (isEnemyDefeated(t.Statuses, t.StatusLimits)) t.Defeated = true;
      log(`${a?.Name ?? 'Someone'} gives ${t.Name} ${statusName} ${rank}${t.Defeated ? ' — defeated!' : '.'}`)(d);
    });
    setEngaging(null);
  }

  function offerToPC(targetId: string, rank: number, statusName: string) {
    if (!engaging) return;
    const actorId = engaging.actor.Id;
    const kindLabel = engaging.kind === 'Melee' ? 'Engage in Melee' : 'Engage at Range';
    commitEncounter((d) => {
      const a = d.Participants.find((x) => x.Id === actorId);
      const t = d.Participants.find((x) => x.Id === targetId);
      if (a) a.ActionPointsRemaining = Math.max(0, a.ActionPointsRemaining - 1);
      d.PendingStatusOffers.push({
        Id: newId('pso'),
        TargetParticipantId: targetId,
        StatusName: statusName,
        Polarity: 'Negative',
        Rank: rank,
        Note: `From ${a?.Name ?? 'an attacker'}'s ${kindLabel}`,
      });
      log(`${a?.Name ?? 'Someone'} offers ${t?.Name ?? 'a target'} ${statusName} ${rank}.`)(d);
    });
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
      });
    }
    commitEncounter((d) => {
      d.PendingStatusOffers = d.PendingStatusOffers.filter((o) => o.Id !== offerId);
    });
    setResistingOfferId(null);
  }

  function recuperate(statusId: string, amount: number) {
    commitSheet((d) => {
      d.Statuses = healStatus(d.Statuses, statusId, amount);
      d.Recoveries = Math.max(0, d.Recoveries - 1);
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

  function help(target: CombatParticipant) {
    if (party.Rapport <= 0) return;
    commitParty((d) => { d.Rapport = Math.max(0, d.Rapport - 1); });
    commitEncounter(log(`${myParticipant?.Name ?? 'Someone'} helps ${target.Name} (-1 Rapport).`));
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
        newParticipant({ Kind: 'Enemy', RefId: template.Id, Name: template.Name, Toughness: template.Toughness, StatusLimits: template.StatusLimits }),
      );
    });
    setAddingParticipant(false);
  }

  function addAdhocEnemy(name: string, toughness: ToughnessTier, limits: EnemyStatusLimit[], saveToLibrary: boolean) {
    commitEncounter((d) => {
      d.Participants.push(newParticipant({ Kind: 'Enemy', RefId: '', Name: name, Toughness: toughness, StatusLimits: limits }));
    });
    if (saveToLibrary) {
      api.library
        .create('enemies', { Name: name, Description: '', IsBoss: false, Toughness: toughness, StatusLimits: limits })
        .then(() => qc.invalidateQueries({ queryKey: ['library'] }))
        .catch((err) => console.error('enemy save failed', err));
    }
    setAddingParticipant(false);
  }

  return (
    <div>
      <div className={styles.header}>
        <h2 className={styles.goal}>
          {encounter.CombatGoal ? <GlossaryText text={encounter.CombatGoal} matcher={matcher} /> : 'No Combat Goal set.'}
        </h2>
        <div className={styles.headerRow}>
          <span>Round {encounter.Round}</span>
          <span>Acting: {encounter.ActingSide ?? 'Not rolled'}</span>
          {isGM && !readOnly && (
            <>
              <button className={`tap-inline ${styles.headerButton}`} onClick={() => commitEncounter((d) => { d.ActingSide = d.ActingSide === 'Party' ? 'Enemies' : 'Party'; })}>
                Toggle Acting Side
              </button>
              <input
                className={styles.initiativeInput}
                type="number"
                placeholder="2d6"
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
              <button
                className={`tap-inline ${styles.headerButton}`}
                onClick={() => commitEncounter((d) => { d.Participants = startNewRound(d.Participants); d.Round += 1; log('New round.')(d); })}
              >
                Next Round
              </button>
              <button className={`tap-inline ${styles.headerButton}`} onClick={() => setConfirmingEnd(true)}>
                End Combat
              </button>
              <button className={`tap-inline ${styles.headerButton}`} onClick={() => setAddingParticipant(true)}>
                Add Participant
              </button>
            </>
          )}
        </div>
      </div>

      {myOffers.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Incoming</h3>
          {myOffers.map((o) => (
            <div key={o.Id} className={styles.offer}>
              <div className={styles.offerText}>
                {o.StatusName} {o.Rank} — {o.Note}
              </div>
              {resistingOfferId === o.Id ? (
                <div className={styles.offerRow}>
                  <select className={styles.offerSelect} value={resistVirtue} onChange={(e) => setResistVirtue(e.target.value)}>
                    {library.virtues.map((v) => (
                      <option key={v.Id} value={v.Id}>
                        {v.Name}
                      </option>
                    ))}
                  </select>
                  <select className={styles.offerSelect} value={resistTier} onChange={(e) => setResistTier(e.target.value as RollTier)}>
                    <option value="Tier3">10+</option>
                    <option value="Tier2">7–9</option>
                    <option value="Tier1">Miss</option>
                  </select>
                  <button className={`tap-inline ${styles.offerButton}`} onClick={() => applyOffer(o.Id, true)}>
                    Apply Resisted
                  </button>
                </div>
              ) : (
                <div className={styles.offerRow}>
                  <button className={`tap-inline ${styles.offerButton}`} onClick={() => applyOffer(o.Id, false)}>
                    Apply
                  </button>
                  <button className={`tap-inline ${styles.offerButton}`} onClick={() => setResistingOfferId(o.Id)}>
                    Resist first
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Defiant Goals</h3>
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
                  className={`tap-inline ${styles.headerButton}`}
                  style={{ color: 'inherit', borderColor: 'currentColor' }}
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
              className={`tap-inline ${styles.headerButton}`}
              style={{ color: 'var(--ink)', borderColor: 'var(--ink-25)' }}
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
        <h3 className={styles.sectionTitle}>Party</h3>
        {partyParticipants.length === 0 && <p className={styles.empty}>No one from the party is in this fight.</p>}
        {partyParticipants.map((p) => (
          <ParticipantCard
            key={p.Id}
            participant={p}
            statuses={statusesFor(p)}
            canControl={isGM || p.RefId === myCharacterId}
            canEngage={p.RefId === myCharacterId}
            isOwnPC={p.RefId === myCharacterId}
            canRecuperate={p.RefId === myCharacterId && (mySheet?.Recoveries ?? 0) > 0 && (mySheet?.Statuses.length ?? 0) > 0}
            canDefend={p.RefId === myCharacterId && !!mySheet?.Armor.some((a) => !a.Used)}
            canHelp={p.RefId !== myCharacterId && !!myParticipant && party.Rapport > 0}
            onSetAP={(n) => setAP(p, n)}
            onReposition={(delta) => reposition(p, delta)}
            onEngageMelee={() => setEngaging({ actor: p, kind: 'Melee' })}
            onEngageRanged={() => setEngaging({ actor: p, kind: 'Ranged' })}
            onRecuperate={() => setRecuperating(true)}
            onDefend={defend}
            onHelp={() => help(p)}
            onRemove={() => removeParticipant(p)}
          />
        ))}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Enemies</h3>
        {enemyParticipants.length === 0 && <p className={styles.empty}>No enemies added.</p>}
        {enemyParticipants.map((p) => (
          <ParticipantCard
            key={p.Id}
            participant={p}
            statuses={statusesFor(p)}
            canControl={isGM}
            canEngage={isGM}
            isOwnPC={false}
            canRecuperate={false}
            canDefend={false}
            canHelp={false}
            onSetAP={(n) => setAP(p, n)}
            onReposition={(delta) => reposition(p, delta)}
            onEngageMelee={() => setEngaging({ actor: p, kind: 'Melee' })}
            onEngageRanged={() => setEngaging({ actor: p, kind: 'Ranged' })}
            onRecuperate={() => {}}
            onDefend={() => {}}
            onHelp={() => {}}
            onRemove={() => removeParticipant(p)}
          />
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
        <HealStatusModal
          statuses={mySheet.Statuses}
          mettleScore={mySheet.Virtues.find((v) => v.VirtueId === 'v-mettle')?.Score ?? 0}
          recoveries={mySheet.Recoveries}
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
          body="This closes the Encounter. Everyone should mark Potential if the Combat Goal was achieved — that's not automatic, since only a player can spend their own Potential track."
          confirmLabel="End Combat"
          onConfirm={() => { setConfirmingEnd(false); onEnd(); }}
          onCancel={() => setConfirmingEnd(false)}
        />
      )}
    </div>
  );
}
