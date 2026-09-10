import { useState } from 'react';
import type { CampaignBootstrap, Clock, ClockKind } from '@asohav/shared';
import { applyClockRoll, clockOutcome, isClockFull, newId, nowIso, tickClock, type RollTier } from '@asohav/shared';
import { useClockActions } from '../../lib/mutations.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { InlineEdit } from '../../components/InlineEdit.js';
import { TagList } from '../../components/TagList.js';
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

const KIND_LABEL: Record<ClockKind, string> = {
  Opposition: 'Opposition',
  Threat: 'Threat',
  Project: 'Project',
  TugOfWar: 'Tug-of-War',
};

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

/** A4 item 3's "accumulating stack of quest cards" — a promoted Threat's headline, not a second
 *  copy of its full interactive card. Deliberately decorative (no buttons/inputs of its own): the
 *  same Clock also renders as a full `ClockCard` in the Open list below, and a second copy of that
 *  card's own element ids (the risk-row `aria-labelledby` target, in particular) would collide if
 *  this reused it instead. */
function QuestBoardCard({ clock, matcher }: { clock: Clock; matcher: ReturnType<typeof useGlossaryMatcher> }) {
  return (
    <div className={styles.questCard}>
      <div className={styles.questCardTitle}>
        <GlossaryText text={clock.Title} matcher={matcher} />
      </div>
      {clock.Goal && (
        <div className={styles.questCardGoal}>
          <GlossaryText text={clock.Goal} matcher={matcher} />
        </div>
      )}
      <Segments filled={clock.SuccessMarks} total={clock.Segments} tone="plain" />
    </div>
  );
}

function NewClockForm({ onCreate, onCancel }: { onCreate: (title: string, kind: ClockKind, segments: number) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ClockKind>('Opposition');
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
        <option value="Opposition">Opposition (Success / Failure, Heroes roll)</option>
        <option value="Threat">Threat (a brewing danger, GM ticks it)</option>
        <option value="Project">Project (a Hero's own pursuit, GM ticks it)</option>
        <option value="TugOfWar">Tug-of-War (single track, can go either way)</option>
      </select>
      {kind === 'Threat' && (
        <p className={styles.formHint}>2-4 segments for a nearby Threat, 4-6 for a regional one, 7+ for a Realm-spanning one.</p>
      )}
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
  isGM,
  archived,
  matcher,
  onSave,
  onRemove,
}: {
  clock: Clock;
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
  const [justAddedDevId, setJustAddedDevId] = useState<string | null>(null);

  const readOnly = archived || clock.Status === 'Resolved';
  const editableByGM = !readOnly && isGM;

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

  function addDevelopment() {
    const id = newId('dev');
    onSave({ ...clock, Developments: [...clock.Developments, { Id: id, Text: '', Triggered: false }] });
    setJustAddedDevId(id);
  }

  function updateDevelopment(id: string, patch: Partial<{ Text: string; Triggered: boolean }>) {
    setJustAddedDevId(null);
    onSave({ ...clock, Developments: clock.Developments.map((d) => (d.Id === id ? { ...d, ...patch } : d)) });
  }

  function removeDevelopment(id: string) {
    onSave({ ...clock, Developments: clock.Developments.filter((d) => d.Id !== id) });
  }

  const spendable = Math.min(clock.SuccessMarks, 4);
  const hasGoalField = clock.Kind === 'Threat' || clock.Kind === 'Project';

  return (
    <div className={`${styles.card} ${clock.Status === 'Resolved' ? styles.cardResolved : ''}`}>
      <div className={styles.head}>
        <span className={styles.title}>
          <GlossaryText text={clock.Title} matcher={matcher} />
        </span>
        <span className={styles.badge}>{KIND_LABEL[clock.Kind]}</span>
        {clock.PromotedToBoard && <span className={styles.badge}>Quest Board</span>}
        {clock.Status === 'Open' && isClockFull(clock) && clock.Kind !== 'Opposition' && <span className={styles.badge}>Full</span>}
        {clock.Status === 'Resolved' && <span className={styles.resolvedBadge}>{clock.ResolvedAs ?? 'Resolved'}</span>}
        {isGM && (
          <button className={`tap-inline ${styles.removeButton}`} onClick={() => setConfirmingRemove(true)} aria-label={`Remove ${clock.Title}`}>
            &times;
          </button>
        )}
      </div>

      {hasGoalField && (
        <div className={styles.trackRow}>
          <span className={styles.trackLabel}>Goal</span>
          {editableByGM ? (
            <InlineEdit
              className={styles.goalText}
              value={clock.Goal}
              placeholder="How this changes things for the worse…"
              ariaLabel="Clock Goal"
              onCommit={(next) => onSave({ ...clock, Goal: next })}
            />
          ) : clock.Goal ? (
            <span className={styles.goalText}>
              <GlossaryText text={clock.Goal} matcher={matcher} />
            </span>
          ) : (
            <span className={styles.goalEmpty}>No Goal set.</span>
          )}
        </div>
      )}

      {clock.Kind === 'Threat' && (
        <div className={styles.trackRow}>
          <span className={styles.trackLabel}>Skill Tags</span>
          {editableByGM ? (
            <TagList
              items={clock.SkillTags}
              onChange={(next) => onSave({ ...clock, SkillTags: next })}
              addLabel="+ Skill Tag"
              placeholder="Skill, NPC, location…"
              ariaPrefix="Threat Skill Tag"
            />
          ) : clock.SkillTags.length > 0 ? (
            <span className={styles.goalText}>{clock.SkillTags.join(' · ')}</span>
          ) : (
            <span className={styles.goalEmpty}>None yet.</span>
          )}
        </div>
      )}

      {clock.Kind === 'Threat' ? (
        <>
          <div className={styles.trackRow}>
            <Segments filled={clock.SuccessMarks} total={clock.Segments} tone="plain" />
          </div>
          <div className={styles.devSection}>
            <div className={styles.fieldLabel}>Developments</div>
            {clock.Developments.length === 0 && !editableByGM && <span className={styles.goalEmpty}>None yet.</span>}
            {clock.Developments.map((dev) => (
              <div key={dev.Id} className={styles.devRow}>
                {editableByGM ? (
                  <InlineEdit
                    className={styles.devText}
                    value={dev.Text}
                    placeholder="What happens…"
                    ariaLabel="Development"
                    startEditing={dev.Id === justAddedDevId}
                    onCommit={(next) => updateDevelopment(dev.Id, { Text: next })}
                  />
                ) : (
                  <span className={styles.devText}>
                    <GlossaryText text={dev.Text || 'Unwritten.'} matcher={matcher} />
                  </span>
                )}
                {editableByGM ? (
                  <>
                    <button
                      type="button"
                      className={`tap-inline ${styles.devToggle} ${dev.Triggered ? styles.devToggleOn : ''}`}
                      aria-pressed={dev.Triggered}
                      onClick={() => updateDevelopment(dev.Id, { Triggered: !dev.Triggered })}
                    >
                      {dev.Triggered ? 'Triggered' : 'Not yet'}
                    </button>
                    <button
                      type="button"
                      className={`tap-inline ${styles.removeButton}`}
                      onClick={() => removeDevelopment(dev.Id)}
                      aria-label="Remove this Development"
                    >
                      &times;
                    </button>
                  </>
                ) : (
                  dev.Triggered && <span className={styles.badge}>Triggered</span>
                )}
              </div>
            ))}
            {editableByGM && (
              <button type="button" className={`tap-inline ${styles.lightButton}`} onClick={addDevelopment}>
                + Add Development
              </button>
            )}
          </div>
        </>
      ) : clock.Kind === 'Opposition' ? (
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

      {!readOnly && clock.Kind === 'Opposition' && (
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

      {!readOnly && clock.Kind !== 'Opposition' && isGM && (
        <div className={`tap-row ${styles.riskRow}`}>
          {clock.Kind === 'Threat' || clock.Kind === 'Project' ? (
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
          {clock.Kind === 'Threat' && (
            <button
              className={`tap-inline ${styles.actionButton}`}
              aria-pressed={clock.PromotedToBoard}
              onClick={() => onSave({ ...clock, PromotedToBoard: !clock.PromotedToBoard })}
            >
              {clock.PromotedToBoard ? 'Remove from Quest Board' : 'Promote to Quest Board'}
            </button>
          )}
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
  const questBoard = open.filter((c) => c.Kind === 'Threat' && c.PromotedToBoard);

  return (
    <div>
      {questBoard.length > 0 && (
        <div className={styles.questBoard}>
          <SectionHead title="Quest Board" size="sm" />
          <div className={styles.questBoardRow}>
            {questBoard.map((clock) => (
              <QuestBoardCard key={clock.Id} clock={clock} matcher={matcher} />
            ))}
          </div>
        </div>
      )}

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
