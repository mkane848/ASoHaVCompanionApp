import { useState } from 'react';
import type { CampaignBootstrap, Clock, ClockKind } from '@asohav/shared';
import { applyClockRoll, clockOutcome, isClockFull, isClockLocked, newId, nowIso, tickClock, type RollTier } from '@asohav/shared';
import { useClockActions } from '../../lib/mutations.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { SectionHead } from '../../components/SectionHead.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import { NumberInput } from '../../components/form/NumberInput.js';
import styles from './ClocksPanel.module.css';

const TIER_BUTTONS: { tier: RollTier; label: string }[] = [
  { tier: 'Tier3', label: '10+' },
  { tier: 'Tier2', label: '7–9' },
  { tier: 'Tier1', label: '6−' },
];

const SPEND_OPTIONS = [
  'Learn something important about another side.',
  'Find something advantageous after the failure.',
  'Grant Advantage Forward to all Heroes involved.',
  'Inflict Disadvantage Forward on the opposing side.',
];

function logEntry(text: string) {
  return { Id: newId('clh'), At: nowIso(), Text: text };
}

/** A dot row for a Clock's track — visual only, not independently tappable (same reasoning
 *  CampaignBonds.tsx's own local `Pips` already established for Bond dots), so it carries none of
 *  `layout.css`'s `.pip-row` touch-overlay machinery, which exists for a different, tappable kind
 *  of pip. Segment counts vary per Clock (4, 6, 8, ...), unlike a Status's fixed 6. */
function Segments({ filled, total, tone }: { filled: number; total: number; tone: 'success' | 'failure' | 'plain' }) {
  return (
    <div className={styles.segments}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`${styles.segment} ${i < filled ? (tone === 'failure' ? styles.segmentFailure : tone === 'success' ? styles.segmentSuccess : styles.segmentPlain) : ''}`}
        />
      ))}
    </div>
  );
}

function NewClockForm({ onCreate, onCancel }: { onCreate: (title: string, kind: ClockKind, segments: number) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ClockKind>('Basic');
  const [segments, setSegments] = useState(4);
  return (
    <div className={styles.newForm}>
      <label className={styles.formLabel} htmlFor="new-clock-title">
        Title
      </label>
      <input
        id="new-clock-title"
        className={styles.formInput}
        placeholder="Castle, Perimeter Guard, Revolution…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label className={styles.formLabel} htmlFor="new-clock-kind">
        Kind
      </label>
      <select id="new-clock-kind" className={styles.formInput} value={kind} onChange={(e) => setKind(e.target.value as ClockKind)}>
        <option value="Basic">Basic (Success / Failure, Heroes roll)</option>
        <option value="Countdown">Countdown (single track, GM ticks it)</option>
        <option value="TugOfWar">Tug-of-War (single track, can go either way)</option>
      </select>
      <label className={styles.formLabel} htmlFor="new-clock-segments">
        Segments
      </label>
      <input
        id="new-clock-segments"
        type="number"
        className={styles.formInput}
        min={2}
        step={2}
        value={segments}
        onChange={(e) => setSegments(parseInt(e.target.value, 10) || 4)}
      />
      <div className={`action-grid ${styles.newFormActions}`}>
        <button className={`tap-inline ${styles.lightButton}`} disabled={!title.trim()} onClick={() => onCreate(title.trim(), kind, segments)}>
          Create
        </button>
        <button className={`tap-inline ${styles.lightButton}`} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ClockCard({
  clock,
  allClocks,
  isGM,
  archived,
  matcher,
  onSave,
  onRemove,
}: {
  clock: Clock;
  allClocks: Clock[];
  isGM: boolean;
  archived: boolean;
  matcher: ReturnType<typeof useGlossaryMatcher>;
  onSave: (clock: Clock) => void;
  onRemove: () => void;
}) {
  const [risk, setRisk] = useState<1 | 2 | 3 | null>(null);
  const [tickAmount, setTickAmount] = useState('1');
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [confirmingResolve, setConfirmingResolve] = useState(false);

  const locked = isClockLocked(clock, allClocks);
  const readOnly = archived || locked || clock.Status === 'Resolved';

  function applyRoll(tier: RollTier) {
    if (!risk) return;
    const { SuccessMarks, FailureMarks } = applyClockRoll(clock, risk, tier);
    const tierLabel = TIER_BUTTONS.find((t) => t.tier === tier)?.label ?? tier;
    const updated: Clock = { ...clock, SuccessMarks, FailureMarks, History: [logEntry(`Risked ${risk} Headway, rolled ${tierLabel}.`), ...clock.History] };
    const outcome = clockOutcome(updated);
    if (outcome) {
      updated.Status = 'Resolved';
      updated.ResolvedAs = outcome === 'Failure' ? 'Failure' : 'Success';
      updated.History = [logEntry(outcome === 'Failure' ? 'The Heroes have failed.' : 'The Heroes succeeded!'), ...updated.History];
    }
    onSave(updated);
    setRisk(null);
  }

  function tick(delta: number) {
    const updated: Clock = { ...clock, SuccessMarks: tickClock(clock, delta), History: [logEntry(`Ticked ${delta > 0 ? '+' : ''}${delta}.`), ...clock.History] };
    onSave(updated);
  }

  function resolveManually() {
    onSave({ ...clock, Status: 'Resolved', History: [logEntry('Marked Resolved.'), ...clock.History] });
    setConfirmingResolve(false);
  }

  function spend(option: string) {
    onSave({ ...clock, History: [logEntry(`Spends Headway to: ${option}`), ...clock.History] });
  }

  const spendable = Math.min(clock.SuccessMarks, 4);

  return (
    <div className={`${styles.card} ${clock.Status === 'Resolved' ? styles.cardResolved : ''}`}>
      <div className={styles.head}>
        <span className={styles.title}>
          <GlossaryText text={clock.Title} matcher={matcher} />
        </span>
        <span className={styles.badge}>{clock.Kind}</span>
        {locked && <span className={styles.badge}>Locked</span>}
        {clock.Status === 'Open' && isClockFull(clock) && clock.Kind !== 'Basic' && <span className={styles.badge}>Full</span>}
        {clock.Status === 'Resolved' && <span className={styles.resolvedBadge}>{clock.ResolvedAs ?? 'Resolved'}</span>}
        {isGM && (
          <button className={`tap-inline ${styles.removeButton}`} onClick={() => setConfirmingRemove(true)} aria-label={`Remove ${clock.Title}`}>
            &times;
          </button>
        )}
      </div>

      {clock.Kind === 'Basic' ? (
        <>
          <div className={styles.trackRow}>
            <span className={styles.trackLabel}>Success</span>
            <Segments filled={clock.SuccessMarks} total={clock.Segments} tone="success" />
          </div>
          <div className={styles.trackRow}>
            <span className={styles.trackLabel}>Failure</span>
            <Segments filled={clock.FailureMarks ?? 0} total={clock.Segments} tone="failure" />
          </div>
        </>
      ) : (
        <div className={styles.trackRow}>
          <Segments filled={clock.SuccessMarks} total={clock.Segments} tone="plain" />
        </div>
      )}

      {!readOnly && clock.Kind === 'Basic' && (
        <div className={styles.rollBox}>
          <div className={styles.fieldLabel} id={`clock-risk-${clock.Id}`}>
            Headway risked
          </div>
          <div className={`tap-row ${styles.riskRow}`} role="group" aria-labelledby={`clock-risk-${clock.Id}`}>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={risk === n}
                className={`tap-inline ${styles.riskButton} ${risk === n ? styles.riskButtonActive : ''}`}
                onClick={() => setRisk(n as 1 | 2 | 3)}
              >
                {n}
              </button>
            ))}
          </div>
          {risk && (
            <div className={`tap-row ${styles.riskRow}`}>
              {TIER_BUTTONS.map((t) => (
                <button key={t.tier} type="button" className={`tap-inline ${styles.actionButton}`} onClick={() => applyRoll(t.tier)}>
                  Rolled {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!readOnly && clock.Kind !== 'Basic' && isGM && (
        <div className={`tap-row ${styles.riskRow}`}>
          {clock.Kind === 'Countdown' ? (
            [1, 2, 3].map((n) => (
              <button key={n} className={`tap-inline ${styles.actionButton}`} onClick={() => tick(n)}>
                +{n}
              </button>
            ))
          ) : (
            <>
              <NumberInput aria-label="Tick amount" className={styles.tickInput} value={tickAmount} onChange={(e) => setTickAmount(e.target.value)} />
              <button className={`tap-inline ${styles.actionButton}`} onClick={() => tick(Math.abs(parseInt(tickAmount, 10) || 0))}>
                Tick up
              </button>
              <button className={`tap-inline ${styles.actionButton}`} onClick={() => tick(-Math.abs(parseInt(tickAmount, 10) || 0))}>
                Tick down
              </button>
            </>
          )}
          <button className={`tap-inline ${styles.actionButton}`} onClick={() => setConfirmingResolve(true)}>
            Resolve
          </button>
        </div>
      )}

      {clock.Status === 'Resolved' && clock.ResolvedAs === 'Failure' && (
        <div className={styles.spendBox}>
          <p className={styles.spendNote}>
            The Heroes made {clock.SuccessMarks} Headway despite failing — up to {spendable} of it can be spent, 1-for-1, on:
          </p>
          <div className={styles.spendList}>
            {SPEND_OPTIONS.map((opt) => (
              <button key={opt} className={`tap-inline ${styles.actionButton}`} onClick={() => spend(opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {confirmingRemove && (
        <ConfirmModal
          title="Remove this Clock?"
          body={`${clock.Title} will be removed. This can't be undone from here.`}
          confirmLabel="Remove"
          onConfirm={() => { onRemove(); setConfirmingRemove(false); }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}

      {confirmingResolve && (
        <ConfirmModal
          title="Resolve this Clock?"
          body="Marks it Resolved. Say what happens at the table — this app just tracks that it's done."
          confirmLabel="Resolve"
          onConfirm={resolveManually}
          onCancel={() => setConfirmingResolve(false)}
        />
      )}
    </div>
  );
}

export function ClocksPanel({ campaignId, boot }: { campaignId: string; boot: CampaignBootstrap }) {
  const isGM = boot.membership.Role === 'GM';
  const archived = boot.campaign.Status === 'Archived';
  const clockActions = useClockActions(campaignId);
  const matcher = useGlossaryMatcher();
  const [creating, setCreating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const open = boot.clocks.filter((c) => c.Status === 'Open');
  const resolved = boot.clocks.filter((c) => c.Status === 'Resolved');

  return (
    <div>
      {isGM && !archived && (
        creating ? (
          <NewClockForm
            onCreate={(title, kind, segments) => {
              clockActions.create(title, kind, segments);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button className={`tap-inline ${styles.lightButton}`} onClick={() => setCreating(true)}>
            New Clock
          </button>
        )
      )}

      {open.length === 0 && <p className={styles.empty}>No Clocks right now.</p>}
      {open.map((clock) => (
        <ClockCard
          key={clock.Id}
          clock={clock}
          allClocks={boot.clocks}
          isGM={isGM}
          archived={!!archived}
          matcher={matcher}
          onSave={clockActions.save}
          onRemove={() => clockActions.remove(clock.Id)}
        />
      ))}

      {resolved.length > 0 && (
        <>
          <SectionHead
            title="Resolved"
            size="sm"
            extra={
              <button type="button" className={`tap-inline ${styles.lightButton}`} onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen}>
                {historyOpen ? 'Hide' : 'Show'} ({resolved.length})
              </button>
            }
          />
          {historyOpen &&
            resolved.map((clock) => (
              <ClockCard
                key={clock.Id}
                clock={clock}
                allClocks={boot.clocks}
                isGM={isGM}
                archived={!!archived}
                matcher={matcher}
                onSave={clockActions.save}
                onRemove={() => clockActions.remove(clock.Id)}
              />
            ))}
        </>
      )}
    </div>
  );
}
