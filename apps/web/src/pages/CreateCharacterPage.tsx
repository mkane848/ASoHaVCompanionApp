import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { STANDARD_VIRTUE_ARRAY, campaignPhase, type MeResponse } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useGlossaryMatcher } from '../lib/useGlossaryMatcher.js';
import { GlossaryText } from '../components/GlossaryText.js';
import { api } from '../lib/api.js';
import styles from './CreateCharacterPage.module.css';

const VIRTUE_VALUES = [2, 1, 0, -1] as const;

/** The one character-creation screen in the app — see CLAUDE.md/README's note that this never
 * existed before. Reached from a just-accepted invite (or "No character on this campaign yet"
 * in the Campaign Shell) when a Player membership has no CharacterId, once the GM has closed
 * signup and moved the campaign into the Party Creation phase. Virtue/Theme are locked
 * everywhere else in the app once a sheet exists, so this is also the only place they're chosen. */
export default function CreateCharacterPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading: bootLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const matcher = useGlossaryMatcher();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [playerName, setPlayerName] = useState(me.user.Name);
  const [looks, setLooks] = useState<string[]>(['']);
  const [themeId, setThemeId] = useState('');
  const [questIds, setQuestIds] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [abilityIds, setAbilityIds] = useState<string[]>([]);
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
  if (campaignPhase(boot.campaign) !== 'PartyCreation') {
    return <Navigate to={`/c/${campaignId}`} replace />;
  }

  const virtues = library.virtues;
  const theme = library.themes.find((t) => t.Id === themeId);
  const startingQuest = theme ? library.quests.find((q) => q.Id === theme.StartingQuestId) : undefined;
  const optionalQuests = theme ? theme.QuestIds.filter((id) => id !== theme.StartingQuestId) : [];
  const startingAbilities = library.abilities.filter((a) => a.Acquisition === 'Starting');
  const nonEmptyLooks = looks.map((l) => l.trim()).filter(Boolean);
  const settings = library.settings;

  function availableValuesFor(rowIndex: number): number[] {
    const counts = new Map<number, number>();
    for (const v of STANDARD_VIRTUE_ARRAY) counts.set(v, (counts.get(v) ?? 0) + 1);
    assignments.forEach((a, i) => {
      if (i !== rowIndex && a !== null) counts.set(a, (counts.get(a) ?? 0) - 1);
    });
    return [...counts.entries()].filter(([, c]) => c > 0).map(([v]) => v);
  }

  function selectTheme(id: string) {
    setThemeId(id);
    setQuestIds([]); // optional Quests are theme-scoped — clear on theme change
  }

  function toggleQuest(id: string) {
    setQuestIds((prev) => (prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id]));
  }

  function toggleSkill(id: string) {
    setSkillIds((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= settings.SkillsAtCreation) return prev;
      return [...prev, id];
    });
  }

  function toggleAbility(id: string) {
    setAbilityIds((prev) => {
      if (prev.includes(id)) return prev.filter((a) => a !== id);
      if (prev.length >= settings.AbilitiesAtCreation) return prev;
      return [...prev, id];
    });
  }

  const allAssigned = assignments.every((a) => a !== null);
  const canSubmit = name.trim() && playerName.trim() && themeId && allAssigned && nonEmptyLooks.length > 0 && !submitting;

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
        looks: nonEmptyLooks,
        questIds,
        skillIds,
        abilityIds,
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
        <div className={styles.cardLabel}>Looks</div>
        <p className={styles.cardHint}>A few phrases describing how your character appears.</p>
        {looks.map((look, i) => (
          <div key={i} className={styles.looksRow}>
            <input
              className={styles.input}
              value={look}
              onChange={(e) => setLooks((prev) => prev.map((l, idx) => (idx === i ? e.target.value : l)))}
              placeholder="A look…"
            />
            {looks.length > 1 && (
              <button
                type="button"
                className={`tap ${styles.removeLook}`}
                onClick={() => setLooks((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label="Remove this look"
              >
                &times;
              </button>
            )}
          </div>
        ))}
        <button type="button" className={`tap-inline ${styles.addLook}`} onClick={() => setLooks((prev) => [...prev, ''])}>
          + Add a look
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Assign your Virtues</div>
        <p className={styles.cardHint}>Every character starts from the same array — 2, 1, 0, 0, -1 — assigned however you like.</p>
        {virtues.map((v, i) => {
          const available = availableValuesFor(i);
          return (
            <div key={v.Id} className={styles.virtueRow}>
              <div className={styles.virtueInfo}>
                <span className={styles.virtueName}>{v.Name}</span>
                <span className={styles.virtueTagline}>{v.Tagline}</span>
              </div>
              <div className={styles.virtueRadios} role="radiogroup" aria-label={`${v.Name} score`}>
                {VIRTUE_VALUES.map((val) => {
                  const checked = assignments[i] === val;
                  const disabled = !checked && !available.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      disabled={disabled}
                      className={`${styles.radioOption} ${checked ? styles.radioOptionSelected : ''} ${disabled ? styles.radioOptionDisabled : ''}`}
                      onClick={() => setAssignments((prev) => prev.map((a, idx) => (idx === i ? val : a)))}
                    >
                      {val > 0 ? `+${val}` : val}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.card}>
        <label className={styles.fieldLabel}>
          Theme
          <select className={styles.select} value={themeId} onChange={(e) => selectTheme(e.target.value)}>
            <option value="">Choose a Theme…</option>
            {library.themes.map((t) => (
              <option key={t.Id} value={t.Id}>
                {t.Name}
              </option>
            ))}
          </select>
        </label>
        {theme && (
          <>
            <p className={styles.cardHint}>
              <GlossaryText text={theme.Description} matcher={matcher} />
            </p>
            <div className={styles.questBlock}>
              <div className={styles.cardLabel}>Starting Quest</div>
              <p className={styles.questText}>{startingQuest?.Name}</p>
            </div>
            {optionalQuests.length > 0 && (
              <div className={styles.questBlock}>
                <div className={styles.cardLabel}>Optional Quests</div>
                <p className={styles.cardHint}>Accept as many as you like from your Theme.</p>
                {optionalQuests.map((qid) => {
                  const q = library.quests.find((x) => x.Id === qid);
                  if (!q) return null;
                  return (
                    <CheckboxRow key={qid} checked={questIds.includes(qid)} onToggle={() => toggleQuest(qid)}>
                      {q.Name}
                    </CheckboxRow>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Starting Skills</div>
        <p className={styles.cardHint}>Choose up to {library.settings.SkillsAtCreation}.</p>
        {library.skills.map((s) => {
          const checked = skillIds.includes(s.Id);
          const capped = !checked && skillIds.length >= library.settings.SkillsAtCreation;
          return (
            <CheckboxRow key={s.Id} checked={checked} disabled={capped} onToggle={() => toggleSkill(s.Id)}>
              <strong>{s.Name}</strong> — <GlossaryText text={s.Effect} matcher={matcher} />
            </CheckboxRow>
          );
        })}
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Starting Abilities</div>
        <p className={styles.cardHint}>Choose up to {library.settings.AbilitiesAtCreation}.</p>
        {startingAbilities.map((a) => {
          const checked = abilityIds.includes(a.Id);
          const capped = !checked && abilityIds.length >= library.settings.AbilitiesAtCreation;
          return (
            <CheckboxRow key={a.Id} checked={checked} disabled={capped} onToggle={() => toggleAbility(a.Id)}>
              <strong>{a.Name}</strong> — <GlossaryText text={a.RulesText} matcher={matcher} />
            </CheckboxRow>
          );
        })}
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Rapport &amp; Kin</div>
        <p className={styles.cardHint}>
          Rapport starts at 0 for the whole party. Kin bonds with the rest of the party form once everyone's playing — both are
          tracked automatically once you're in.
        </p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button className={`tap-inline ${styles.submit}`} onClick={submit} disabled={!canSubmit}>
        {submitting ? 'Creating…' : 'Create character'}
      </button>
    </div>
  );
}

/** A tappable checkbox row — a real button (not a native `<input type="checkbox">`, which this
 * app never uses; see VirtuesPanel.tsx's Condition toggle for the same pattern) sized with a
 * genuine 44px min-height rather than a `.tap` overlay, since these stack tightly in a vertical
 * list and an overlay would bleed into neighboring rows. */
function CheckboxRow({
  checked,
  disabled,
  onToggle,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      className={`${styles.checkboxRow} ${disabled ? styles.checkboxRowDisabled : ''}`}
      onClick={onToggle}
    >
      <span className={`${styles.checkGlyph} ${checked ? styles.checkGlyphMarked : ''}`} aria-hidden>
        {checked ? '✓' : ''}
      </span>
      <span className={styles.checkLabel}>{children}</span>
    </button>
  );
}
