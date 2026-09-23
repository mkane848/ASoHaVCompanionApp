import { useState } from 'react';
import type { CharacterSheet, CombatParticipant, Encounter, Library, RollTier, StatusSeverity } from '@asohav/shared';
import { markStrain, rangeBandDistance, resistReduction, statusAbsorb, statusSeverityCounts, strainExhausted, takeStatus } from '@asohav/shared';
import { SectionHead } from '../../components/SectionHead.js';
import { log } from './encounterLog.js';
import styles from './EncounterView.module.css';

const SEVERITIES: StatusSeverity[] = ['Minor', 'Major', 'Severe'];

/** The viewer's own incoming Strain offers, and the Subdued notice resolving one can raise. An
 *  Enemy's attack can't write to a Hero's sheet, so it waits here for that Hero's own player (see
 *  `PendingStrainOffer`). Always mounted, so its in-progress choices survive re-renders. */
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
  const [resistingOfferId, setResistingOfferId] = useState<string | null>(null);
  const [resistTier, setResistTier] = useState<RollTier>('Tier2');
  const [takingStatusOfferId, setTakingStatusOfferId] = useState<string | null>(null);
  const [offerStatusSeverity, setOfferStatusSeverity] = useState<StatusSeverity>('Minor');
  const [offerStatusName, setOfferStatusName] = useState('');
  /** A Strain offer that left the target Subdued (see `strainExhausted`) — Combat only points the
   *  player at their own sheet rather than duplicating anything here. */
  const [subduedByOffer, setSubduedByOffer] = useState(false);

  const slotCaps: Record<StatusSeverity, number> = {
    Minor: library.settings.MinorStatusSlots,
    Major: library.settings.MajorStatusSlots,
    Severe: library.settings.SevereStatusSlots,
  };
  const myOffers = myParticipant ? encounter.PendingStrainOffers.filter((o) => o.TargetParticipantId === myParticipant.Id) : [];
  const myFreeSlots: Record<StatusSeverity, boolean> = {
    Minor: statusSeverityCounts(mySheet?.Statuses ?? []).Minor < slotCaps.Minor,
    Major: statusSeverityCounts(mySheet?.Statuses ?? []).Major < slotCaps.Major,
    Severe: statusSeverityCounts(mySheet?.Statuses ?? []).Severe < slotCaps.Severe,
  };

  /** Resolves an incoming Strain offer three ways (V0.6 slice 1 / Section B1): apply it in full,
   *  Resist (reduce it by 2/1/0 based on tier), or take a Status instead (absorbing a flat 2/4/6 by
   *  severity). Whatever's left after either method lands on the Strain track. */
  function resolveOffer(offerId: string, reduction: number, takenStatus: { Severity: StatusSeverity; Name: string; Description: string } | null) {
    const offer = encounter.PendingStrainOffers.find((o) => o.Id === offerId);
    if (!offer) return;
    const finalAmount = Math.max(0, offer.Amount - reduction);
    let subdued = false;
    commitSheet((d) => {
      // Subdued is an event: tested before marking (see StatusesPanel's applyTakeStrain).
      if (finalAmount > 0) subdued = strainExhausted(d.Strain, finalAmount, library.settings.StrainTrackLength);
      if (takenStatus) d.Statuses = takeStatus(d.Statuses, takenStatus);
      if (finalAmount > 0) d.Strain = markStrain(d.Strain, finalAmount, library.settings.StrainTrackLength);
    });
    if (subdued) setSubduedByOffer(true);
    commitEncounter((d) => {
      d.PendingStrainOffers = d.PendingStrainOffers.filter((o) => o.Id !== offerId);
    });
    setResistingOfferId(null);
    setTakingStatusOfferId(null);
    setOfferStatusName('');
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
                  <select className={styles.actionSelect} value={resistTier} onChange={(e) => setResistTier(e.target.value as RollTier)}>
                    <option value="Tier3">10+</option>
                    <option value="Tier2">7–9</option>
                    <option value="Tier1">Miss</option>
                  </select>
                  <button
                    className={`tap-inline ${styles.actionButton}`}
                    onClick={() => resolveOffer(o.Id, resistReduction(resistTier), null)}
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
            <button className={`tap-inline ${styles.actionButton}`} onClick={() => interpose(o.Id)}>
              Interpose
            </button>
          </div>
        );
      })}
    </div>
  );
}
