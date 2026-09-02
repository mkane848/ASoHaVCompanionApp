import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  STANDARD_VIRTUE_ARRAYS,
  campaignPhase,
  characterCreationSchema,
  type CampaignBootstrap,
  type CharacterCreationInput,
  type Library,
  type MeResponse,
} from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useGlossaryMatcher } from '../lib/useGlossaryMatcher.js';
import { GlossaryText } from '../components/GlossaryText.js';
import { CheckboxRow } from '../components/form/CheckboxRow.js';
import { api } from '../lib/api.js';
import styles from './CreateCharacterPage.module.css';

function formatArray(arr: readonly number[]): string {
  return [...arr]
    .sort((a, b) => b - a)
    .map((v) => (v > 0 ? `+${v}` : String(v)))
    .join(', ');
}

/** The one character-creation screen in the app — see CLAUDE.md/README's note that this never
 * existed before. Reached from a just-accepted invite (or "No character on this campaign yet"
 * in the Campaign Shell) when a Player membership has no CharacterId, once the GM has closed
 * signup and moved the campaign into the Party Creation phase. Virtue/Theme are locked
 * everywhere else in the app once a sheet exists, so this is also the only place they're chosen. */
export default function CreateCharacterPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading: bootLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();

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

  // useForm needs a schema bound to `library`, and hooks can't run conditionally — so the actual
  // form lives in a child that only mounts once every guard above has already passed and
  // `boot`/`library`/`campaignId` are guaranteed non-null, rather than gymnastics to make
  // useForm tolerate them being loading/undefined on some renders.
  return <CreateCharacterForm me={me} campaignId={campaignId!} boot={boot} library={library} />;
}

function CreateCharacterForm({
  me,
  campaignId,
  boot,
  library,
}: {
  me: MeResponse;
  campaignId: string;
  boot: CampaignBootstrap;
  library: Library;
}) {
  const matcher = useGlossaryMatcher();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // The Virtue array/assignment picker is intermediate UI state that *produces* the `virtues`
  // field react-hook-form actually tracks (via setValue below) — it doesn't map 1:1 onto a
  // submitted field the way every other control here does, so it stays outside the form.
  const [arrayIndex, setArrayIndex] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<(number | null)[]>([null, null, null, null, null]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const virtues = library.virtues;
  const startingAbilities = library.abilities.filter((a) => a.Acquisition === 'Starting');
  const settings = library.settings;

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CharacterCreationInput>({
    resolver: zodResolver(characterCreationSchema(library)),
    defaultValues: {
      name: '',
      playerName: me.user.Name,
      themeId: '',
      virtues: [],
      looks: [''],
      questIds: [],
      skillIds: [],
      abilityIds: [],
    },
  });

  const themeId = watch('themeId');
  const looks = watch('looks');
  const questIds = watch('questIds');
  const skillIds = watch('skillIds');
  const abilityIds = watch('abilityIds');

  const theme = library.themes.find((t) => t.Id === themeId);
  const startingQuest = theme ? library.quests.find((q) => q.Id === theme.StartingQuestId) : undefined;
  const optionalQuests = theme ? theme.QuestIds.filter((id) => id !== theme.StartingQuestId) : [];

  const selectedArray = arrayIndex !== null ? STANDARD_VIRTUE_ARRAYS[arrayIndex] : null;
  // The distinct values a chosen array actually offers — not every array uses the same set (e.g.
  // [1,1,1,1,-1] never uses 2 or 0), so this can't be a fixed constant the way it used to be.
  const rowValues = selectedArray ? [...new Set(selectedArray)].sort((a, b) => b - a) : [];

  function availableValuesFor(rowIndex: number): number[] {
    if (!selectedArray) return [];
    const counts = new Map<number, number>();
    for (const v of selectedArray) counts.set(v, (counts.get(v) ?? 0) + 1);
    assignments.forEach((a, i) => {
      if (i !== rowIndex && a !== null) counts.set(a, (counts.get(a) ?? 0) - 1);
    });
    return [...counts.entries()].filter(([, c]) => c > 0).map(([v]) => v);
  }

  // Keeps the RHF-tracked `virtues` field (what's actually validated and submitted) in sync
  // with the array-picker's own local state, every time either changes.
  useEffect(() => {
    if (!assignments.every((a) => a !== null)) {
      setValue('virtues', []);
      return;
    }
    setValue(
      'virtues',
      virtues.map((v, i) => ({ virtueId: v.Id, score: assignments[i]! })),
      { shouldValidate: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments]);

  function selectArray(idx: number) {
    setArrayIndex(idx);
    setAssignments([null, null, null, null, null]); // a different array invalidates prior assignments
  }

  function selectTheme(id: string) {
    setValue('themeId', id);
    setValue('questIds', []); // optional Quests are theme-scoped — clear on theme change
  }

  function toggleQuest(id: string) {
    setValue('questIds', questIds.includes(id) ? questIds.filter((q) => q !== id) : [...questIds, id]);
  }

  function toggleSkill(id: string) {
    if (skillIds.includes(id)) {
      setValue('skillIds', skillIds.filter((s) => s !== id));
    } else if (skillIds.length < settings.SkillsAtCreation) {
      setValue('skillIds', [...skillIds, id]);
    }
  }

  function toggleAbility(id: string) {
    if (abilityIds.includes(id)) {
      setValue('abilityIds', abilityIds.filter((a) => a !== id));
    } else if (abilityIds.length < settings.AbilitiesAtCreation) {
      setValue('abilityIds', [...abilityIds, id]);
    }
  }

  function updateLook(i: number, value: string) {
    setValue('looks', looks.map((l, idx) => (idx === i ? value : l)));
  }

  async function onSubmit(data: CharacterCreationInput) {
    setSubmitError(null);
    try {
      const { character } = await api.character.create(campaignId, {
        name: data.name,
        playerName: data.playerName,
        themeId: data.themeId,
        virtues: data.virtues,
        looks: data.looks,
        questIds: data.questIds,
        skillIds: data.skillIds,
        abilityIds: data.abilityIds,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['bootstrap', campaignId] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ]);
      void character;
      navigate(`/c/${campaignId}/sheet`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create your character.');
    }
  }

  // react-hook-form's own errors surface field-shape problems; the array/assignment picker isn't
  // itself a registered field, so it needs its own explicit check for the submit button's
  // disabled state (empty `virtues` already fails schema validation, but disabling the button
  // makes that failure mode unreachable rather than just caught after the fact).
  const allAssigned = assignments.every((a) => a !== null);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Create your character</h1>
      <p className={styles.subtitle}>Joining {boot.campaign.Name}.</p>

      <div className={styles.card}>
        <label className={styles.fieldLabel}>
          Character name
          <input className={styles.input} {...register('name')} placeholder="Their name…" />
        </label>
        {errors.name && <p className={styles.error}>{errors.name.message}</p>}
        <label className={styles.fieldLabel}>
          Player name
          <input className={styles.input} {...register('playerName')} placeholder="Your name…" />
        </label>
        {errors.playerName && <p className={styles.error}>{errors.playerName.message}</p>}
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Looks</div>
        <p className={styles.cardHint}>A few phrases describing how your character appears.</p>
        {looks.map((look, i) => (
          <div key={i} className={styles.looksRow}>
            <input className={styles.input} value={look} onChange={(e) => updateLook(i, e.target.value)} placeholder="A look…" />
            {looks.length > 1 && (
              <button
                type="button"
                className={`tap ${styles.removeLook}`}
                onClick={() => setValue('looks', looks.filter((_, idx) => idx !== i))}
                aria-label="Remove this look"
              >
                &times;
              </button>
            )}
          </div>
        ))}
        <button type="button" className={`tap-inline ${styles.addLook}`} onClick={() => setValue('looks', [...looks, ''])}>
          + Add a look
        </button>
        {errors.looks && <p className={styles.error}>{errors.looks.message as string}</p>}
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Choose your Virtue array</div>
        <p className={styles.cardHint}>Every character starts from one of these five arrays.</p>
        <div className={styles.arrayOptions} role="radiogroup" aria-label="Virtue array">
          {STANDARD_VIRTUE_ARRAYS.map((arr, idx) => {
            const checked = arrayIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                role="radio"
                aria-checked={checked}
                className={`${styles.arrayOption} ${checked ? styles.arrayOptionSelected : ''}`}
                onClick={() => selectArray(idx)}
              >
                {formatArray(arr)}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Assign your Virtues</div>
        <p className={styles.cardHint}>
          {selectedArray ? 'Assign each value from your chosen array to a different Virtue.' : 'Choose a Virtue array above first.'}
        </p>
        {virtues.map((v, i) => {
          const available = availableValuesFor(i);
          return (
            <div key={v.Id} className={styles.virtueRow}>
              <div className={styles.virtueInfo}>
                <span className={styles.virtueName}>{v.Name}</span>
                <span className={styles.virtueTagline}>{v.Tagline}</span>
              </div>
              <div className={styles.virtueRadios} role="radiogroup" aria-label={`${v.Name} score`}>
                {rowValues.map((val) => {
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
        {errors.virtues && <p className={styles.error}>{errors.virtues.message as string}</p>}
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
        {errors.themeId && <p className={styles.error}>{errors.themeId.message}</p>}
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
        <div className={styles.cardLabel}>Rapport &amp; Bond</div>
        <p className={styles.cardHint}>
          Rapport starts at 0 for the whole party. Bonds with the rest of the party form once everyone's playing — both are
          tracked automatically once you're in.
        </p>
      </div>

      {submitError && <p className={styles.error}>{submitError}</p>}

      <button className={`tap-inline ${styles.submit}`} onClick={handleSubmit(onSubmit)} disabled={!allAssigned || isSubmitting}>
        {isSubmitting ? 'Creating…' : 'Create character'}
      </button>
    </div>
  );
}
