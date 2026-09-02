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
import { api } from '../lib/api.js';
import styles from './CreateCharacterPage.module.css';

function formatArray(arr: readonly number[]): string {
  return [...arr]
    .sort((a, b) => b - a)
    .map((v) => (v > 0 ? `+${v}` : String(v)))
    .join(', ');
}

type MotifDraft = { motifId: string | null; name: string; skillTag: string; flawTag: string; quest: string };

const blankMotif = (): MotifDraft => ({ motifId: null, name: '', skillTag: '', flawTag: '', quest: '' });

/** The one character-creation screen in the app — see CLAUDE.md/README's note that this never
 * existed before. Reached from a just-accepted invite (or "No character on this campaign yet"
 * in the Campaign Shell) when a Player membership has no CharacterId, once the GM has closed
 * signup and moved the campaign into the Party Creation phase. Virtue/Motifs are locked
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

  const [arrayIndex, setArrayIndex] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<(number | null)[]>([null, null, null, null, null]);
  const [motifs, setMotifs] = useState<MotifDraft[]>([blankMotif(), blankMotif(), blankMotif()]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const virtues = library.virtues;

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
      virtues: [],
      looks: [''],
      motifs: [blankMotif(), blankMotif(), blankMotif()],
    },
  });

  const looks = watch('looks');

  // The Virtue array/assignment picker is intermediate UI state that *produces* the `virtues`
  // field react-hook-form actually tracks (via setValue below) — it doesn't map 1:1 onto a
  // submitted field the way every other control here does. The three Motifs get the same
  // treatment: they're a fixed list of four editable strings each, synced into the `motifs` field.
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

  useEffect(() => {
    setValue('motifs', motifs, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motifs]);

  function selectArray(idx: number) {
    setArrayIndex(idx);
    setAssignments([null, null, null, null, null]);
  }

  function updateMotif(index: number, patch: Partial<MotifDraft>) {
    setMotifs((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function selectMotif(index: number, motifId: string) {
    if (!motifId) {
      updateMotif(index, { motifId: null });
      return;
    }
    const picked = library.motifs.find((m) => m.Id === motifId);
    updateMotif(index, { motifId, name: picked ? picked.Name : '' });
  }

  function applyExample(index: number, kind: 'skillTag' | 'flawTag', value: string) {
    updateMotif(index, { [kind]: value });
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
        virtues: data.virtues,
        looks: data.looks,
        motifs: data.motifs,
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

  const selectedArray = arrayIndex !== null ? STANDARD_VIRTUE_ARRAYS[arrayIndex] : null;
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

  const allAssigned = assignments.every((a) => a !== null);
  const motifsComplete = motifs.every((m) => m.name.trim() && m.skillTag.trim() && m.flawTag.trim() && m.quest.trim());

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
        <div className={styles.cardLabel}>Your three Motifs</div>
        <p className={styles.cardHint}>Each Motif is one aspect of your Hero — pick from the list or write your own, then give it a Skill Tag, a Flaw Tag, and a Quest.</p>
        {motifs.map((m, i) => {
          const canonical = m.motifId ? library.motifs.find((x) => x.Id === m.motifId) : undefined;
          return (
            <div key={i} className={styles.motifCard}>
              <div className={styles.motifHead}>
                <div className={styles.cardLabel}>Motif {i + 1}</div>
                <select className={styles.select} value={m.motifId ?? ''} onChange={(e) => selectMotif(i, e.target.value)} aria-label={`Motif ${i + 1} from the list`}>
                  <option value="">Write my own…</option>
                  {library.motifs.map((mo) => (
                    <option key={mo.Id} value={mo.Id}>{mo.Name}</option>
                  ))}
                </select>
              </div>
              <input
                className={styles.input}
                value={m.name}
                onChange={(e) => updateMotif(i, { name: e.target.value })}
                placeholder="Name this Motif…"
                aria-label={`Motif ${i + 1} name`}
              />
              <input
                className={styles.input}
                value={m.skillTag}
                onChange={(e) => updateMotif(i, { skillTag: e.target.value })}
                placeholder="One Skill Tag…"
                aria-label={`Motif ${i + 1} Skill Tag`}
              />
              <input
                className={styles.input}
                value={m.flawTag}
                onChange={(e) => updateMotif(i, { flawTag: e.target.value })}
                placeholder="One Flaw Tag…"
                aria-label={`Motif ${i + 1} Flaw Tag`}
              />
              <input
                className={styles.input}
                value={m.quest}
                onChange={(e) => updateMotif(i, { quest: e.target.value })}
                placeholder="A short-sentence Quest…"
                aria-label={`Motif ${i + 1} Quest`}
              />
              {canonical && (
                <div className={styles.motifExamples}>
                  {canonical.Description && <p className={styles.motifDescription}><GlossaryText text={canonical.Description} matcher={matcher} /></p>}
                  <ExampleChips label="Skill ideas" values={canonical.SkillTagExamples} onPick={(v) => applyExample(i, 'skillTag', v)} />
                  <ExampleChips label="Flaw ideas" values={canonical.FlawTagExamples} onPick={(v) => applyExample(i, 'flawTag', v)} />
                </div>
              )}
            </div>
          );
        })}
        {errors.motifs && <p className={styles.error}>{errors.motifs.message as string}</p>}
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Rapport &amp; Bond</div>
        <p className={styles.cardHint}>
          Rapport starts at 0 for the whole party. Bonds with the rest of the party form once everyone's playing — both are
          tracked automatically once you're in.
        </p>
      </div>

      {submitError && <p className={styles.error}>{submitError}</p>}

      <button className={`tap-inline ${styles.submit}`} onClick={handleSubmit(onSubmit)} disabled={!allAssigned || !motifsComplete || isSubmitting}>
        {isSubmitting ? 'Creating…' : 'Create character'}
      </button>
    </div>
  );
}

function ExampleChips({ label, values, onPick }: { label: string; values: string[]; onPick: (v: string) => void }) {
  if (!values.length) return null;
  return (
    <div className={styles.exampleBlock}>
      <div className={styles.exampleLabel}>{label}</div>
      <div className={styles.exampleChips}>
        {values.map((v) => (
          <button key={v} type="button" className={styles.exampleChip} onClick={() => onPick(v)}>{v}</button>
        ))}
      </div>
    </div>
  );
}
