import { useState } from 'react';
import type { CharacterSheet, CombatParticipant, Encounter, Library, RollTier, StatusSeverity } from '@asohav/shared';
import { markCondition, markStrain, rangeBandDistance, resistReduction, statusAbsorb, statusSeverityCounts, strainExhausted, takeStatus } from '@asohav/shared';
import { SectionHead } from '../../components/SectionHead.js';
import { HeroRollBuilder } from '../roll/HeroRollBuilder.js';
import { useMisfortune } from '../../lib/useMisfortune.js';
import { log } from './encounterLog.js';
import styles from './EncounterView.module.css';

const SEVERITIES: StatusSeverity[] = ['Minor', 'Major', 'Severe'];
const TIER_LABELS: Record<RollTier, string> = { Tier3: '10+', Tier2: '7–9', Tier1: '6-' };
const TIER_BUTTONS: { tier: RollTier; label: string }[] = (['Tier3', 'Tier2', 'Tier1'] as const).map((tier) => ({ tier, label: TIER_LABELS[tier] }));

/** The viewer's own incoming Strain offers, and the Subdued notice resolving one can raise. An
 *  Enemy's attack can't write to a Hero's sheet, so it waits here for that Hero's own player (see
 *  `PendingStrainOffer`). Always mounted, so its in-progress choices survive re-renders.
 *
 *  Resolving one follows the revised V0.6 "Resolving an Enemy Attack" order: Fortify's −1 first;
 *  then Resist — a Hero Roll reducing 2/1/0 (a 6- gives the GM a Misfortune) or a Status absorbing
 *  2/4/6 — unless the offer can't be Resisted; then, with Strain still left, Defend (a Reaction,
 *  1 AP) marks an Armor box to negate the rest; then whatever is left is marked. */
export function IncomingOffers({
  encounter,
  library,
  myParticipant,
  mySheet,
  commitSheet,
  commitEncounter,
}: {
  encounter: Encounter;
  library: Library;
  myParticipant: CombatParticipant | undefined;
  mySheet: CharacterSheet | null;
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  commitEncounter: (m: (d: Encounter) => void) => void;
}) {
  const misfortune = useMisfortune(encounter.CampaignId);
  // One offer is resolved at a time; these describe that one.
  const [resolvingOfferId, setResolvingOfferId] = useState<string | null>(null);
  const [method, setMethod] = useState<'roll' | 'status' | 'none' | null>(null);
  const [tier, setTier] = useState<RollTier | null>(null);
  const [severity, setSeverity] = useState<StatusSeverity>('Minor');
  const [statusName, setStatusName] = useState('');
  const [defending, setDefending] = useState(false);
  const [armorId, setArmorId] = useState<string | null>(null);
  /** A Strain offer that left the target Subdued (see `strainExhausted`) — Combat only points the
   *  player at their own sheet rather than duplicating anything here. */
  const [subduedByOffer, setSubduedByOffer] = useState(false);
  /** An offer's Additional Effect resulted in the target Crumbling (all Conditions marked). */
  const [crumbledByOffer, setCrumbledByOffer] = useState(false);
  /** The text of an Additional Effect that happened and should be shown in a notice. */
  const [additionalEffectNotice, setAdditionalEffectNotice] = useState<string | null>(null);

  const slotCaps: Record<StatusSeverity, number> = {
    Minor: library.settings.MinorStatusSlots,
    Major: library.settings.MajorStatusSlots,
    Severe: library.settings.SevereStatusSlots,
  };
  const myOffers = myParticipant ? encounter.PendingStrainOffers.filter((o) => o.TargetParticipantId === myParticipant.Id) : [];
  const counts = statusSeverityCounts(mySheet?.Statuses ?? []);
  const myFreeSlots: Record<StatusSeverity, boolean> = {
    Minor: counts.Minor < slotCaps.Minor,
    Major: counts.Major < slotCaps.Major,
    Severe: counts.Severe < slotCaps.Severe,
  };
  const readyArmor = mySheet?.Armor.filter((a) => !a.Used) ?? [];
  const surprised = !!myParticipant?.Surprised;

  const offer = myOffers.find((o) => o.Id === resolvingOfferId) ?? null;
  const incoming = offer ? Math.max(0, offer.Amount - (myParticipant?.Fortified ? 1 : 0)) : 0;
  const resistSettled =
    !!offer &&
    (offer.Amount === 0 ||
      !offer.Resistable ||
      method === 'none' ||
      (method === 'roll' && tier !== null) ||
      (method === 'status' && myFreeSlots[severity] && statusName.trim().length > 0));
  const reduction = method === 'roll' && tier ? resistReduction(tier) : method === 'status' ? statusAbsorb(severity) : 0;
  const afterResist = offer?.Resistable ? Math.max(0, incoming - reduction) : incoming;
  const canDefend = resistSettled && afterResist > 0 && readyArmor.length > 0;
  const defended = canDefend && defending && armorId !== null;
  const finalAmount = defended ? 0 : afterResist;
  const canApply = resistSettled && (!defending || defended);

  function startResolving(offerId: string) {
    setResolvingOfferId(offerId);
    setMethod(null);
    setTier(null);
    setSeverity(SEVERITIES.find((s) => myFreeSlots[s]) ?? 'Minor');
    setStatusName('');
    setDefending(false);
    setArmorId(null);
  }

  function apply() {
    if (!offer || !myParticipant || !canApply) return;
    const me = myParticipant.Name;
    const tookStatus = offer.Resistable && method === 'status';
    let subdued = false;
    let crumbled = false;
    let effectHappened = false;

    // Determine if Additional Effect happens based on its trigger
    if (offer.AdditionalEffect) {
      const trigger = offer.EffectTrigger ?? 'OnStrain';
      if (trigger === 'OnStrain') {
        effectHappened = finalAmount > 0;
      } else if (trigger === 'Regardless') {
        effectHappened = true;
      } else if (trigger === 'OnMissedResist') {
        effectHappened = offer.Resistable && method === 'roll' && tier === 'Tier1';
      } else if (trigger === 'InsteadOfStrain') {
        effectHappened = true;
      }
    }

    commitSheet((d) => {
      // Subdued is an event: tested before marking (see StatusesPanel's applyTakeStrain).
      if (finalAmount > 0) subdued = strainExhausted(d.Strain, finalAmount, library.settings.StrainTrackLength);
      if (tookStatus) d.Statuses = takeStatus(d.Statuses, { Severity: severity, Name: statusName.trim(), Description: offer.Note });
      if (defended) {
        const a = d.Armor.find((x) => x.Id === armorId);
        if (a) a.Used = true;
      }
      // Mark Condition if the attack specifies one
      if (offer.ConditionVirtueId) {
        const result = markCondition(d, offer.ConditionVirtueId);
        if (result.Crumbled) crumbled = true;
      }
      if (finalAmount > 0) d.Strain = markStrain(d.Strain, finalAmount, library.settings.StrainTrackLength);
    });
    commitEncounter((d) => {
      d.PendingStrainOffers = d.PendingStrainOffers.filter((o) => o.Id !== offer.Id);
      if (defended) {
        const p = d.Participants.find((x) => x.Id === myParticipant.Id);
        if (p) p.ActionPointsRemaining = Math.max(0, p.ActionPointsRemaining - 1);
      }
      const how =
        offer.Resistable && method === 'roll' && tier
          ? `Resists (${TIER_LABELS[tier]})`
          : tookStatus
            ? `takes a ${severity} Status (${statusName.trim()})`
            : 'takes the hit';
      const logMsg = offer.AttackName
        ? `${me} takes ${offer.AttackName} and ${how}${defended ? ', Defends with Armor,' : ''} and marks ${finalAmount} Strain.`
        : `${me} ${how}${defended ? ', Defends with Armor,' : ''} and marks ${finalAmount} Strain.`;
      log(logMsg)(d);
      if (effectHappened && offer.AdditionalEffect) {
        log(`Additional Effect: ${offer.AdditionalEffect}`)(d);
      }
    });
    if (offer.Resistable && method === 'roll' && tier === 'Tier1') misfortune.gain('A 6- on a Resist');
    if (subdued) setSubduedByOffer(true);
    if (crumbled) setCrumbledByOffer(true);
    if (effectHappened && offer.AdditionalEffect) setAdditionalEffectNotice(offer.AdditionalEffect);
    setResolvingOfferId(null);
  }

  // Helper function to get Virtue names from IDs
  function getVirtueNames(virtueIds?: string[]): string {
    if (!virtueIds || virtueIds.length === 0) return '';
    return virtueIds
      .map((id) => library.virtues.find((v) => v.Id === id)?.Name)
      .filter(Boolean)
      .join(' or ');
  }

  // Helper function to get Condition name
  function getConditionName(virtueId?: string | null): string | undefined {
    if (!virtueId) return undefined;
    return library.conditions.find((c) => c.VirtueId === virtueId)?.Name;
  }

  // Helper function to get effect trigger label
  function getEffectTriggerLabel(trigger?: string): string {
    const labels: Record<string, string> = {
      OnStrain: 'if they mark any Strain',
      Regardless: 'regardless of Resistance',
      OnMissedResist: 'on a 6- Resistance Roll',
      InsteadOfStrain: 'instead of Strain',
    };
    return labels[trigger ?? 'OnStrain'] ?? trigger ?? '';
  }

  return (
    <>
      {subduedByOffer && (
        <div className={`${styles.section} ${styles.offer}`}>
          <p className={styles.offerText}>
            <strong>Subdued.</strong> You can't continue the conflict. With the GM, describe how your Hero is removed from immediate danger — knocked unconscious, pinned, captured, separated, or forced to retreat. Subdual doesn't kill a Hero unless you agree it should.
          </p>
          <button className={`tap-inline ${styles.actionButton}`} onClick={() => setSubduedByOffer(false)}>
            Got it
          </button>
        </div>
      )}

      {crumbledByOffer && (
        <div className={`${styles.section} ${styles.offer}`}>
          <p className={styles.offerText}>
            <strong>You Crumble</strong> — you can only act to flee or stay put. Say how you leave the scene, then clear one Condition on your sheet.
          </p>
          <button className={`tap-inline ${styles.actionButton}`} onClick={() => setCrumbledByOffer(false)}>
            Got it
          </button>
        </div>
      )}

      {additionalEffectNotice && (
        <div className={`${styles.section} ${styles.offer}`}>
          <p className={styles.offerText}>
            <strong>Additional Effect:</strong> {additionalEffectNotice}
          </p>
          <button className={`tap-inline ${styles.actionButton}`} onClick={() => setAdditionalEffectNotice(null)}>
            Got it
          </button>
        </div>
      )}

      {myOffers.length > 0 && (
        <div className={styles.section}>
          <SectionHead title="Incoming" size="sm" />
          {myOffers.map((o) =>
            o.Id !== offer?.Id ? (
              <div key={o.Id} className={styles.offer}>
                <div className={styles.offerText}>
                  {o.AttackName ? (
                    <>
                      <strong>{o.AttackName}</strong> — {o.Amount > 0 ? `${o.Amount} Strain` : "No Strain"}
                      {o.SuggestedVirtueIds && o.SuggestedVirtueIds.length > 0 && (
                        <> · Resist with {getVirtueNames(o.SuggestedVirtueIds)}</>
                      )}
                      {o.ConditionVirtueId && (
                        <> · Mark {getConditionName(o.ConditionVirtueId)}</>
                      )}
                      {o.AdditionalEffect && (
                        <> · {o.AdditionalEffect} ({getEffectTriggerLabel(o.EffectTrigger)})</>
                      )}
                    </>
                  ) : (
                    <>
                      {o.Amount} Strain — {o.Note}
                      {!o.Resistable && " (can’t be Resisted)"}
                    </>
                  )}
                </div>
                <button className={`tap-inline ${styles.actionButton}`} onClick={() => startResolving(o.Id)}>
                  Resolve
                </button>
              </div>
            ) : (
              <div key={o.Id} className={styles.offer}>
                <div className={styles.offerText}>
                  {o.AttackName ? (
                    <>
                      <strong>{o.AttackName}</strong> — {o.Amount > 0 ? `${o.Amount} Strain` : "No Strain"}
                      {o.SuggestedVirtueIds && o.SuggestedVirtueIds.length > 0 && (
                        <> · Resist with {getVirtueNames(o.SuggestedVirtueIds)}</>
                      )}
                      {o.ConditionVirtueId && (
                        <> · Mark {getConditionName(o.ConditionVirtueId)}</>
                      )}
                      {o.AdditionalEffect && (
                        <> · {o.AdditionalEffect} ({getEffectTriggerLabel(o.EffectTrigger)})</>
                      )}
                    </>
                  ) : (
                    <>
                      {o.Amount} Strain — {o.Note}
                    </>
                  )}
                </div>
                {myParticipant?.Fortified && incoming > 0 && <p className={styles.note}>Fortify: −1, so {incoming} incoming.</p>}

                {o.Amount === 0 ? (
                  <p className={styles.note}>{o.EffectTrigger === 'InsteadOfStrain' ? 'No Strain — the effect happens instead.' : 'No Strain to Resist.'}</p>
                ) : o.Resistable ? (
                  <div className={styles.resistStep}>
                    <div className={`tap-row ${styles.tierRow}`} role="group" aria-label="How do you Resist?">
                      <button
                        type="button"
                        aria-pressed={method === 'roll'}
                        className={`tap-inline ${styles.toggle} ${method === 'roll' ? styles.toggleActive : ''}`}
                        onClick={() => { setMethod('roll'); setDefending(false); setArmorId(null); }}
                      >
                        Roll to Resist
                      </button>
                      <button
                        type="button"
                        aria-pressed={method === 'status'}
                        className={`tap-inline ${styles.toggle} ${method === 'status' ? styles.toggleActive : ''}`}
                        disabled={!SEVERITIES.some((s) => myFreeSlots[s])}
                        onClick={() => { setMethod('status'); setDefending(false); setArmorId(null); }}
                      >
                        Take a Status
                      </button>
                      <button
                        type="button"
                        aria-pressed={method === 'none'}
                        className={`tap-inline ${styles.toggle} ${method === 'none' ? styles.toggleActive : ''}`}
                        onClick={() => { setMethod('none'); setDefending(false); setArmorId(null); }}
                      >
                        Don’t Resist
                      </button>
                    </div>

                    {method === 'roll' && (
                      <div className={styles.resistBox}>
                        {mySheet && <HeroRollBuilder mode="Resist" virtueId={null} sheet={mySheet} library={library} commit={commitSheet} inCombat />}
                        <div className={`tap-row ${styles.tierRow}`} role="group" aria-label="Which tier did you roll?">
                          {TIER_BUTTONS.map((t) => (
                            <button
                              key={t.tier}
                              type="button"
                              aria-pressed={tier === t.tier}
                              className={`tap-inline ${styles.tierButton} ${tier === t.tier ? styles.tierButtonActive : ''}`}
                              onClick={() => setTier(t.tier)}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <p className={styles.helpText}>10+ reduces it by 2 · 7–9 by 1 · 6- by 0, and the GM gains a Misfortune.</p>
                      </div>
                    )}

                    {method === 'status' && (
                      <div className={styles.resistBox}>
                        <label className={styles.label} htmlFor={`offer-severity-${o.Id}`}>
                          Severity (absorbs Minor 2 · Major 4 · Severe 6)
                        </label>
                        <select
                          id={`offer-severity-${o.Id}`}
                          className={styles.actionSelect}
                          value={severity}
                          onChange={(e) => setSeverity(e.target.value as StatusSeverity)}
                        >
                          {SEVERITIES.map((sev) => (
                            <option key={sev} value={sev} disabled={!myFreeSlots[sev]}>
                              {sev}{!myFreeSlots[sev] ? ' (no free slot)' : ''}
                            </option>
                          ))}
                        </select>
                        <label className={styles.label} htmlFor={`offer-status-name-${o.Id}`}>
                          Status name
                        </label>
                        <input
                          id={`offer-status-name-${o.Id}`}
                          className={styles.declareInput}
                          value={statusName}
                          onChange={(e) => setStatusName(e.target.value)}
                          placeholder="Broken Arm, Concussed…"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className={styles.note}>This can’t be Resisted.</p>
                )}

                {canDefend && (
                  <div className={styles.defendStep}>
                    <button
                      type="button"
                      aria-pressed={defending}
                      className={`tap-inline ${styles.toggle} ${defending ? styles.toggleActive : ''}`}
                      disabled={surprised}
                      onClick={() => { setDefending((v) => !v); setArmorId(null); }}
                    >
                      Defend (1 AP): mark Armor to negate the remaining {afterResist} Strain
                    </button>
                    {surprised && <p className={styles.note}>You’re surprised — no Reactions this round.</p>}
                    {!surprised && (myParticipant?.ActionPointsRemaining ?? 0) <= 0 && <p className={styles.note}>You have no AP left.</p>}
                    {defending && (
                      <div className={`board ${styles.armorPicker}`} role="group" aria-label="Pick an Armor to mark">
                        {readyArmor.map((a) => {
                          const armorType = library.armorTypes.find((t) => t.Id === a.ArmorTypeId);
                          return (
                            <button
                              key={a.Id}
                              type="button"
                              aria-pressed={armorId === a.Id}
                              className={`tap-inline posting ${styles.armorButton} ${armorId === a.Id ? styles.armorButtonActive : ''}`}
                              onClick={() => setArmorId(armorId === a.Id ? null : a.Id)}
                            >
                              {armorType?.Name ?? a.ArmorTypeId} {a.SourceLabel && `(${a.SourceLabel})`}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {resistSettled && <p className={styles.result}>Strain marked: {finalAmount}</p>}

                <div className={styles.offerRow}>
                  <button className={`tap-inline ${styles.actionButton}`} disabled={!canApply} onClick={apply}>
                    Apply
                  </button>
                  <button className={`tap-inline ${styles.actionButton}`} onClick={() => setResolvingOfferId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </>
  );
}

/** Offers heading for an ally within reach, which the viewer can take in their place. */
export function InterposeSection({
  encounter,
  myParticipant,
  partyParticipants,
  commitEncounter,
}: {
  encounter: Encounter;
  myParticipant: CombatParticipant | undefined;
  partyParticipants: CombatParticipant[];
  commitEncounter: (m: (d: Encounter) => void) => void;
}) {
  const interposableOffers = myParticipant
    ? encounter.PendingStrainOffers.filter((o) => {
        if (o.TargetParticipantId === myParticipant.Id) return false;
        const target = partyParticipants.find((p) => p.Id === o.TargetParticipantId);
        return !!target && rangeBandDistance(myParticipant.Range, target.Range) <= 2;
      })
    : [];

  /** Interpose: swap into an ally's space (a real Range swap, not just a copy) and take their
   *  incoming Strain offer instead. You may Resist normally. It's a Reaction, so it costs 1 AP.
   *  The interposer still resolves it themselves afterward, same as any other offer, from their
   *  own card. */
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
        interposer.ActionPointsRemaining = Math.max(0, interposer.ActionPointsRemaining - 1);
      }
      o.TargetParticipantId = interposerId;
      log(`${interposerName} interposes for ${originalTarget?.Name ?? 'an ally'}.`)(d);
    });
  }

  if (interposableOffers.length === 0) return null;
  return (
    <div className={styles.section}>
      <SectionHead title="Interpose" size="sm" />
      {interposableOffers.map((o) => {
        const target = partyParticipants.find((p) => p.Id === o.TargetParticipantId);
        return (
          <div key={o.Id} className={styles.offer}>
            <div className={styles.offerText}>
              {target?.Name ?? 'An ally'} is about to take {o.Amount} Strain.
            </div>
            <button
              className={`tap-inline ${styles.actionButton}`}
              disabled={myParticipant?.Surprised}
              onClick={() => interpose(o.Id)}
            >
              Interpose (1 AP)
            </button>
            {myParticipant?.Surprised && (
              <p className={styles.note}>You're surprised — no Reactions this round.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
