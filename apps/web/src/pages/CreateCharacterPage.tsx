import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { STANDARD_VIRTUE_ARRAY, type MeResponse } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { api } from '../lib/api.js';
import styles from './CreateCharacterPage.module.css';

/** The one character-creation screen in the app — see CLAUDE.md/README's note that this never
 * existed before. Reached from a just-accepted invite (or "No character on this campaign yet"
 * in the Campaign Shell) when a Player membership has no CharacterId. Virtue/Theme are locked
 * everywhere else in the app once a sheet exists, so this is also the only place they're chosen. */
export default function CreateCharacterPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading: bootLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [playerName, setPlayerName] = useState(me.user.Name);
  const [themeId, setThemeId] = useState('');
  const [assignments, setAssignments] = useState<(number | null)[]>([null, null, null, null, null]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (bootLoading || libLoading || !library) {
    return <div className={styles.centered}>Loading…</div>;
  }
  if (!boot) {
    return <div className={styles.centered}>Couldn't load that campaign.</div>;
  }
  if (boot.membership.Role !== 'Player') {
    return <Navigate to={`/c/${campaignId}`} replace />;
  }
  if (boot.membership.CharacterId) {
    return <Navigate to={`/c/${campaignId}/sheet`} replace />;
  }

  const virtues = library.virtues;

  function availableValuesFor(rowIndex: number): number[] {
    const counts = new Map<number, number>();
    for (const v of STANDARD_VIRTUE_ARRAY) counts.set(v, (counts.get(v) ?? 0) + 1);
    assignments.forEach((a, i) => {
      if (i !== rowIndex && a !== null) counts.set(a, (counts.get(a) ?? 0) - 1);
    });
    return [...counts.entries()].filter(([, c]) => c > 0).map(([v]) => v).sort((a, b) => b - a);
  }

  const allAssigned = assignments.every((a) => a !== null);
  const canSubmit = name.trim() && playerName.trim() && themeId && allAssigned && !submitting;

  async function submit() {
    if (!campaignId || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { character } = await api.character.create(campaignId, {
        name: name.trim(),
        playerName: playerName.trim(),
        themeId,
        virtues: virtues.map((v, i) => ({ virtueId: v.Id, score: assignments[i]! })),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['bootstrap', campaignId] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ]);
      void character;
      navigate(`/c/${campaignId}/sheet`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your character.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Create your character</h1>
      <p className={styles.subtitle}>Joining {boot.campaign.Name}.</p>

      <div className={styles.card}>
        <label className={styles.fieldLabel}>
          Character name
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name…" />
        </label>
        <label className={styles.fieldLabel}>
          Player name
          <input className={styles.input} value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Your name…" />
        </label>
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Assign your Virtues</div>
        <p className={styles.cardHint}>Every character starts from the same array — 2, 1, 0, 0, -1 — assigned however you like.</p>
        {virtues.map((v, i) => (
          <div key={v.Id} className={styles.virtueRow}>
            <div className={styles.virtueInfo}>
              <span className={styles.virtueName}>{v.Name}</span>
              <span className={styles.virtueTagline}>{v.Tagline}</span>
            </div>
            <select
              className={styles.select}
              value={assignments[i] ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? null : Number(e.target.value);
                setAssignments((prev) => prev.map((a, idx) => (idx === i ? val : a)));
              }}
            >
              <option value="">—</option>
              {availableValuesFor(i).map((val) => (
                <option key={val} value={val}>
                  {val > 0 ? `+${val}` : val}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <label className={styles.fieldLabel}>
          Theme
          <select className={styles.select} value={themeId} onChange={(e) => setThemeId(e.target.value)}>
            <option value="">Choose a Theme…</option>
            {library.themes.map((t) => (
              <option key={t.Id} value={t.Id}>
                {t.Name}
              </option>
            ))}
          </select>
        </label>
        {themeId && <p className={styles.cardHint}>{library.themes.find((t) => t.Id === themeId)?.Description}</p>}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button className={`tap-inline ${styles.submit}`} onClick={submit} disabled={!canSubmit}>
        {submitting ? 'Creating…' : 'Create character'}
      </button>
    </div>
  );
}
