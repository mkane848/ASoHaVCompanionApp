import { Fragment, useMemo, type ReactNode } from 'react';
import {
  MAX_SCARS,
  buildGlossaryMatcher,
  carriedLoad,
  isPartyTagUsed,
  linkifyText,
  loadCapacityFor,
  secondStrainOpen,
  type Bond,
  type Character,
  type CharacterSheet,
  type Library,
  type Move,
  type MoveResults,
  type Party,
} from '@asohav/shared';
import styles from './PrintSheet.module.css';

/**
 * The printable character sheet.
 *
 * Presentational and pure: it takes the same `CharacterSheet`, `Library`, `Party` and `Bond[]` the
 * live sheet is handed, and prints them. Every label, track length, Condition, Armor type, Load
 * tier and Move text is read from `library` and every value from the sheet, so a change to the
 * seed library or the shared types reaches paper with no edit here. The one thing this file may
 * not do is restate rules text of its own — and `printCoverage.ts` + `PrintSheet.test.tsx` are
 * what hold it to that.
 *
 * `sheet === null` is the blank sheet: the same labels, boxes, pips and Move text, with writing
 * lines where a value would go.
 *
 * The block order is the live sheet's (Virtues, Status, Reminders, Background, Kit, Growth,
 * Connections, Party). Where the live sheet hides a row until it applies (Second Strain, Temporary
 * Strain at zero, Scars) the filled print hides it too.
 */

// Layout constants only — how many writing lines to leave, never a rules number.
const BLANK_LINES = 3;
const BLANK_ARMOR_ROWS = 3;
const BLANK_CONNECTIONS = 2;
const BLANK_CAMP_ASSETS = 2;
const BLANK_LOOKS = 3;
const BLANK_REMINDERS = 3;
const BLANK_IMPROVEMENTS = 3;
/** Act Breaks and Forsakes are each a three-box track — `CharacterMotif.ActBreaks` is typed `0|1|2|3`,
 *  and `MotifPanel` passes the same `max={3}`. There is no library setting to read it from. */
const QUEST_TRACK = 3;

const TIER_LABELS: Record<keyof MoveResults, string> = { Tier3: 'On a 10+', Tier2: 'On a 7–9', Tier1: 'On a miss' };
const TIER_ORDER: (keyof MoveResults)[] = ['Tier3', 'Tier2', 'Tier1'];

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
const signedReminder = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

/** A run of empty writing lines, or the value if there is one. */
function Lines({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={styles.line} />
      ))}
    </>
  );
}

/** `items`, padded with writing lines up to `min` so a filled sheet still has room to add to. */
function List({ items, min, empty }: { items: ReactNode[]; min: number; empty?: string }) {
  const pad = Math.max(0, min - items.length);
  return (
    <ul className={styles.list}>
      {items.length === 0 && empty && pad === 0 ? <li className={styles.none}>{empty}</li> : null}
      {items.map((it, i) => (
        <li key={i} className={styles.listItem}>{it}</li>
      ))}
      {Array.from({ length: pad }, (_, i) => (
        <li key={`pad${i}`} className={styles.listPad}><div className={styles.line} /></li>
      ))}
    </ul>
  );
}

/** A clock-style track: `filled` solid circles out of `count`. */
function Dots({ label, count, filled }: { label: string; count: number; filled: number }) {
  return (
    <span className={styles.dots} role="img" aria-label={`${label}: ${filled} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={i < filled ? styles.dotOn : styles.dot} />
      ))}
    </span>
  );
}

/** A box row (Strain): sparse on purpose, so marks are drawn where they are, each carrying its number. */
function Boxes({ label, marks }: { label: string; marks: boolean[] }) {
  const marked = marks.flatMap((on, i) => (on ? [i + 1] : []));
  return (
    <span
      className={styles.boxes}
      role="img"
      aria-label={`${label}: ${marked.length === 0 ? 'no boxes marked' : `boxes ${marked.join(', ')} marked`}, of ${marks.length}`}
    >
      {marks.map((on, i) => (
        <span key={i} className={on ? styles.boxOn : styles.box}>{on ? i + 1 : ''}</span>
      ))}
    </span>
  );
}

/** One checkbox. Marked draws a ×, so the mark survives a printer that drops backgrounds. */
function Check({ label, marked }: { label: string; marked: boolean }) {
  return (
    <span className={styles.check} role="img" aria-label={`${label}: ${marked ? 'marked' : 'not marked'}`}>
      {marked ? '×' : ''}
    </span>
  );
}

function Block({ title, children, splittable = false }: { title: string; children: ReactNode; splittable?: boolean }) {
  return (
    <section className={`${styles.block} ${splittable ? styles.blockSplit : ''}`}>
      <h2 className={styles.blockTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className={styles.label}>{children}</div>;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value ?? ''}</span>
    </div>
  );
}

function Resource({ label, value }: { label: string; value?: number }) {
  return (
    <div className={styles.resource}>
      <span className={styles.resourceLabel}>{label}</span>
      <span className={styles.resourceBox}>{value ?? ''}</span>
    </div>
  );
}

export type MovesMode = 'off' | 'summary' | 'full';

export interface PrintSheetProps {
  library: Library;
  /** The Hero's sheet, or null for the blank variant. */
  sheet: CharacterSheet | null;
  character?: Character | null;
  party?: Party | null;
  bonds?: Bond[];
  /** Every Hero in the campaign, to name a Connection's other half. */
  characters?: Character[];
  /** The Moves reference after the sheet. `summary` is the Basic Moves, each with its name and what
   *  triggers it (a few inches); `full` is every Move with every result by tier (about six pages —
   *  the Adventure Moves are long procedures); `off` leaves it out. */
  moves?: MovesMode;
  /** Shown in the footer; the page passes today's date. */
  printedOn?: string;
}

export function PrintSheet({ library, sheet, character = null, party = null, bonds = [], characters = [], moves = 'summary', printedOn }: PrintSheetProps) {
  const blank = sheet === null;
  // Explicit `[Term]` tags resolve to their display text; no auto-linking, since paper has no taps.
  const matcher = useMemo(() => buildGlossaryMatcher(library.glossary ?? [], { autoLink: false }), [library.glossary]);
  const plain = (text: string) => linkifyText(text, matcher).map((s) => s.text).join('');

  return (
    <div className={styles.sheet}>
      <header className={styles.masthead}>
        <h1 className={styles.title}>Character Sheet</h1>
        <div className={styles.fields}>
          <Field label="Name" value={character?.Name} />
          <Field label="Pronouns" value={character?.Pronouns} />
          <Field label="Player" value={character?.PlayerName} />
        </div>
      </header>

      <div className={styles.flow}>
        <VirtuesBlock library={library} sheet={sheet} plain={plain} />
        <StatusBlock library={library} sheet={sheet} plain={plain} />
        <RemindersBlock sheet={sheet} plain={plain} />
        <BackgroundBlock library={library} sheet={sheet} plain={plain} />
        <LoadBlock library={library} sheet={sheet} plain={plain} />
        <GrowthBlock sheet={sheet} party={party} library={library} plain={plain} />
        <ConnectionsBlock library={library} sheet={sheet} bonds={bonds} characters={characters} blank={blank} plain={plain} />
        <PartyBlock party={party} blank={blank} plain={plain} />
      </div>

      {moves !== 'off' && <MovesReference library={library} plain={plain} full={moves === 'full'} />}

      <footer className={styles.footer}>
        Printed from the ASoHaV Companion App · library seed {library.SeedVersion}
        {printedOn ? ` · ${printedOn}` : ''}
      </footer>
    </div>
  );
}

type Plain = (text: string) => string;

// ---------- Virtues ----------

function VirtuesBlock({ library, sheet, plain }: { library: Library; sheet: CharacterSheet | null; plain: Plain }) {
  return (
    <Block title="Virtues">
      {library.virtues.map((v) => {
        const cond = library.conditions.find((c) => c.VirtueId === v.Id);
        const vv = sheet?.Virtues.find((x) => x.VirtueId === v.Id);
        return (
          <div key={v.Id} className={styles.virtue}>
            <div className={styles.score}>{vv && <><span className={styles.srOnly}>{v.Name} score </span>{sign(vv.Score)}</>}</div>
            <div className={styles.virtueBody}>
              <div className={styles.virtueHead}>
                <span className={styles.virtueName}>{v.Name}</span>
                <span className={styles.tagline}>{v.Tagline}</span>
              </div>
              <div className={styles.small}>{plain(v.Essence)}</div>
              {cond && (
                <div className={styles.condition}>
                  <Check label={cond.Name} marked={vv?.ConditionMarked === true} />
                  <span className={styles.conditionName}>{cond.Name}</span>
                  <span className={styles.small}>Clear it: {plain(cond.ClearAction)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Block>
  );
}

// ---------- Strain & Status ----------

function StatusBlock({ library, sheet, plain }: { library: Library; sheet: CharacterSheet | null; plain: Plain }) {
  const { settings } = library;
  const strain = sheet?.Strain ?? Array.from({ length: settings.StrainTrackLength }, () => false);
  const showSecond = sheet ? secondStrainOpen(sheet) || sheet.StrainSecond.some(Boolean) : false;
  const tempStrain = sheet?.TempStrain ?? 0;
  const out = sheet && (sheet.LifeState === 'Dead' || sheet.LifeState === 'Retired');
  const dying = sheet?.Dying === true && !out;
  const caps = { Minor: settings.MinorStatusSlots, Major: settings.MajorStatusSlots, Severe: settings.SevereStatusSlots } as const;
  const scars = sheet?.Scars ?? [];

  return (
    <Block title="Strain & Status" splittable>
      {sheet && (out || dying) && (
        <p className={styles.notice}>
          <strong>{out ? sheet.LifeState : 'Dying'}</strong>
          {dying && sheet.DyingChoice ? ` — choice made: ${sheet.DyingChoice === 'Scar' ? 'a Scar' : 'Risk Death'}` : ''}
          {out && sheet.Ending?.Text ? ` — “${sheet.Ending.Text}”` : ''}
        </p>
      )}

      <div className={styles.resources}>
        <Resource label="Wealth" value={sheet?.Wealth ?? undefined} />
        <Resource label="Treasure" value={sheet?.Treasure ?? undefined} />
        <Resource label="Hold" value={sheet?.Hold ?? undefined} />
        
      </div>

      <Label>Armor</Label>
      <div className={styles.armorList}>
        {sheet
          ? sheet.Armor.map((a) => {
              const t = library.armorTypes.find((x) => x.Id === a.ArmorTypeId);
              return (
                <div key={a.Id} className={styles.armor}>
                  <Check label={`${t?.Name ?? a.ArmorTypeId} Armor from ${a.SourceLabel || '—'}`} marked={a.Used} />
                  <div className={styles.armorBody}>
                    <span className={styles.armorName}>{t?.Name ?? a.ArmorTypeId}</span> <span className={styles.small}>from {a.SourceLabel || '—'}</span>
                    {t?.Key === 'Special' && <div className={styles.small}>Stops: {(a.Effects ?? []).length > 0 ? (a.Effects ?? []).join(', ') : 'No effects listed'}</div>}
                  </div>
                  <span className={styles.small}>{a.Used ? 'Spent' : 'Ready'}</span>
                </div>
              );
            })
          : Array.from({ length: BLANK_ARMOR_ROWS }, (_, i) => (
              <div key={i} className={styles.armor}>
                <Check label="Armor" marked={false} />
                <div className={styles.armorBody}><div className={styles.line} /></div>
                <span className={styles.small}>Ready / Spent</span>
              </div>
            ))}
      </div>
      <ul className={styles.legend}>
        {library.armorTypes.map((t) => (
          <li key={t.Id}><strong>{t.Name}</strong> — {plain(t.Description)}</li>
        ))}
      </ul>

      <Label>Strain</Label>
      <Boxes label="Strain" marks={strain} />

      {showSecond && sheet && (
        <>
          <Label>Second Strain</Label>
          <Boxes label="Second Strain" marks={sheet.StrainSecond} />
        </>
      )}

      {(!sheet || tempStrain > 0) && (
        <div className={styles.inline}>
          <Label>Temporary Strain</Label>
          <span className={styles.resourceBox}>{sheet ? tempStrain : ''}</span>
        </div>
      )}

      <Label>{`Healing Track${sheet ? ` — ${sheet.HealingTrack} / ${settings.HealingTrackLength}` : ''}`}</Label>
      <Dots label="Healing Track" count={settings.HealingTrackLength} filled={sheet?.HealingTrack ?? 0} />

      <div className={styles.statusGroups}>
        {(['Minor', 'Major', 'Severe'] as const).map((sev) => {
          const held = sheet?.Statuses.filter((s) => s.Severity === sev) ?? [];
          const free = Math.max(0, caps[sev] - held.length);
          return (
            <div key={sev} className={styles.statusGroup}>
              <Label>{`${sev}${sheet ? ` (${held.length} / ${caps[sev]})` : ` ×${caps[sev]}`}`}</Label>
              {held.map((s) => (
                <div key={s.Id} className={styles.status}>
                  <span className={styles.statusName}>{s.Name || 'Unnamed Status'}</span>
                  {s.Description && <span className={styles.small}> — {s.Description}</span>}
                </div>
              ))}
              <Lines n={free} />
            </div>
          );
        })}
      </div>

      <div className={styles.twoUp}>
        <div>
          <Label>Boons</Label>
          <List items={sheet?.Boons ?? []} min={BLANK_LINES} />
        </div>
        <div>
          <Label>Banes</Label>
          <List items={sheet?.Banes ?? []} min={BLANK_LINES} />
        </div>
      </div>

      {(!sheet || scars.length > 0) && (
        <>
          <Label>Scars</Label>
          <List items={scars.map((s) => s.Text)} min={sheet ? 0 : MAX_SCARS} />
        </>
      )}
    </Block>
  );
}

// ---------- Reminders ----------

function RemindersBlock({ sheet, plain }: { sheet: CharacterSheet | null; plain: Plain }) {
  const reminders = sheet?.Reminders ?? [];
  return (
    <Block title="Reminders">
      <List
        min={sheet ? 0 : BLANK_REMINDERS}
        empty="No reminders."
        items={reminders.map((r) => (
          <>
            <strong>{signedReminder(r.Value)}</strong> {plain(r.Text)}
            <span className={styles.small}> · {r.Kind}{r.Source ? ` · ${r.Source}` : ''}</span>
          </>
        ))}
      />
      {!sheet && <div className={styles.small}>Value · text · Forward / Ongoing · from</div>}
    </Block>
  );
}

// ---------- Background: Motifs and Looks ----------

function BackgroundBlock({ library, sheet, plain }: { library: Library; sheet: CharacterSheet | null; plain: Plain }) {
  const { settings } = library;
  const looks = (sheet?.Looks ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const motifs = sheet?.Motifs ?? [null, null, null];
  return (
    <Block title="Background" splittable>
      <Label>Motifs</Label>
      {motifs.map((m, i) => (
        <div key={i} className={styles.motif}>
          <div className={styles.motifHead}>
            <span className={styles.motifName}>{m ? m.Name || `Motif ${i + 1}` : `Motif ${i + 1}`}</span>
            <span className={styles.trackLine}>
              <span className={styles.small}>Potential</span>
              <Dots label={`Motif ${i + 1} Potential`} count={settings.PotentialTrackLength} filled={m?.Potential ?? 0} />
            </span>
          </div>
          <div className={styles.tagRow}>
            <span className={styles.small}>Skill Tags</span>
            {m ? <span>{m.SkillTags.length > 0 ? m.SkillTags.join(' · ') : 'None'}</span> : <div className={styles.line} />}
          </div>
          <div className={styles.tagRow}>
            <span className={styles.small}>Flaw Tags</span>
            {m ? <span>{m.FlawTags.length > 0 ? m.FlawTags.join(' · ') : 'None'}</span> : <div className={styles.line} />}
          </div>
          <div className={styles.tagRow}>
            <span className={styles.small}>Quest</span>
            {m ? <span>{plain(m.Quest) || '—'}</span> : <div className={styles.line} />}
          </div>
          <div className={styles.trackLine}>
            <span className={styles.small}>Act Breaks</span>
            <Dots label={`Motif ${i + 1} Act Breaks`} count={QUEST_TRACK} filled={m?.ActBreaks ?? 0} />
            <span className={styles.small}>Forsakes</span>
            <Dots label={`Motif ${i + 1} Forsakes`} count={QUEST_TRACK} filled={m?.Forsakes ?? 0} />
          </div>
        </div>
      ))}
      <Label>Looks</Label>
      <List items={looks} min={sheet ? 0 : BLANK_LOOKS} empty="None" />
    </Block>
  );
}

// ---------- Load & Item Charges ----------

function LoadBlock({ library, sheet, plain }: { library: Library; sheet: CharacterSheet | null; plain: Plain }) {
  const might = sheet?.Virtues.find((v) => v.VirtueId === 'v-might')?.Score ?? 0;
  const carried = sheet ? carriedLoad(sheet, library.items, library.armorTypes) : 0;
  const cap = sheet ? loadCapacityFor(sheet.Load.Tier, library.loadTiers, might) : 0;
  const currentNote = sheet ? library.loadTiers.find((t) => t.Key === sheet.Load.Tier)?.Note : undefined;

  // Carried first, then alphabetical, as the live sheet orders them. Blank lists the whole catalogue.
  const rows = sheet
    ? [...sheet.Items]
        .sort((a, b) => {
          if (a.Carried !== b.Carried) return a.Carried ? -1 : 1;
          const an = library.items.find((x) => x.Id === a.ItemId)?.Name ?? '';
          const bn = library.items.find((x) => x.Id === b.ItemId)?.Name ?? '';
          return an.localeCompare(bn);
        })
        .flatMap((ci) => {
          const item = library.items.find((x) => x.Id === ci.ItemId);
          return item ? [{ item, carried: ci.Carried, used: ci.ChargesUsed }] : [];
        })
    : library.items.map((item) => ({ item, carried: false, used: 0 }));

  return (
    <Block title="Load & Item Charges" splittable>
      <div className={styles.tiers}>
        {library.loadTiers.map((t) => {
          const selected = sheet?.Load.Tier === t.Key;
          return (
            <div key={t.Key} className={styles.tier}>
              <Check label={`${t.Key} Load`} marked={selected} />
              <span className={styles.tierKey}>{t.Key}</span>
              <span className={styles.tierCap}>{sheet ? t.Base + might : `${t.Base} + Might`}</span>
            </div>
          );
        })}
      </div>
      {currentNote && <p className={styles.small}>{plain(currentNote)}</p>}
      {!sheet && (
        <ul className={styles.legend}>
          {library.loadTiers.map((t) => (
            <li key={t.Key}><strong>{t.Key}</strong> — {plain(t.Note)}</li>
          ))}
        </ul>
      )}
      <div className={styles.inline}>
        <span className={styles.fieldLabel}>On your person</span>
        <span className={styles.resourceBox}>{sheet ? carried : ''}</span>
        <span className={styles.small}>of</span>
        <span className={styles.resourceBox}>{sheet ? cap : ''}</span>
      </div>

      <Label>Wildcard items</Label>
      <List
        min={sheet ? 0 : BLANK_LINES}
        empty="None declared."
        items={(sheet?.WildcardDeclarations ?? []).map((w) => (
          <>
            {w.Text || 'Unnamed item'} <span className={styles.small}>· {w.Persistent ? 'Persistent' : 'Ordinary'}</span>
          </>
        ))}
      />
      {!sheet && <div className={styles.small}>Persistent / Ordinary</div>}

      <Label>Items</Label>
      {rows.map(({ item, carried: isCarried, used }) => (
        <div key={item.Id} className={styles.item}>
          <div className={styles.itemHead}>
            <Check label={`${item.Name} carried`} marked={isCarried} />
            <span className={styles.itemName}>{item.Name}</span>
            <span className={styles.small}>{item.LoadCost === 0 ? 'concealed' : `${item.LoadCost} load`}</span>
            {(item.Charges ?? 0) > 0 && <Dots label={`${item.Name} Charges used`} count={item.Charges ?? 0} filled={used} />}
          </div>
          {item.Description && <div className={styles.small}>{plain(item.Description)}</div>}
        </div>
      ))}
    </Block>
  );
}

// ---------- Advancement ----------

function GrowthBlock({ sheet, party, library, plain }: { sheet: CharacterSheet | null; party: Party | null; library: Library; plain: Plain }) {
  const rapportLen = library.settings.RapportTrackLength;
  const improvements = sheet?.Improvements ?? [];
  return (
    <Block title="Advancement">
      <div className={styles.trackLine}>
        <Label>Rapport</Label>
        <Dots label="Rapport" count={rapportLen} filled={party ? Math.min(party.Rapport, rapportLen) : 0} />
        <span className={styles.small}>Party · shared · Level {party ? party.PartyLevel ?? 0 : '___'}</span>
      </div>
      <Label>Hero Improvements</Label>
      <List
        min={sheet ? 0 : BLANK_IMPROVEMENTS}
        empty="None yet."
        items={improvements.map((imp) => (
          <>
            <strong>{imp.Name}</strong> — {plain(imp.Effect)}
          </>
        ))}
      />
      {party && party.RapportImprovementsTaken.length > 0 && (
        <>
          <Label>Party Improvements</Label>
          <List
            min={0}
            items={party.RapportImprovementsTaken.map((imp) => (
              <>
                <strong>{imp.Name}</strong> — {plain(imp.Effect)}
              </>
            ))}
          />
        </>
      )}
    </Block>
  );
}

// ---------- Connections ----------

function ConnectionsBlock({
  library,
  sheet,
  bonds,
  characters,
  blank: isBlank,
  plain,
}: {
  library: Library;
  sheet: CharacterSheet | null;
  bonds: Bond[];
  characters: Character[];
  blank: boolean;
  plain: Plain;
}) {
  const bondLen = library.settings.BondTrackLength;
  const myId = sheet?.CharacterId;
  const mine = isBlank ? [] : bonds.filter((b) => b.CharacterAId === myId || b.CharacterBId === myId);
  return (
    <Block title="Connections">
      {isBlank &&
        Array.from({ length: BLANK_CONNECTIONS }, (_, i) => (
          <div key={i} className={styles.connection}>
            <div className={styles.motifHead}>
              <span className={styles.small}>With</span>
              <div className={`${styles.line} ${styles.grow}`} />
              <Dots label="Bond Track" count={bondLen} filled={0} />
            </div>
            <div className={styles.tagRow}>
              <span className={styles.small}>Connection Tag</span>
              <div className={styles.line} />
            </div>
            <div className={styles.tagRow}>
              <span className={styles.small}>Connection Improvements</span>
              <div className={styles.line} />
            </div>
          </div>
        ))}
      {!isBlank && mine.length === 0 && <p className={styles.none}>Not yet paired with another Hero.</p>}
      {mine.map((b) => {
        const otherId = b.CharacterAId === myId ? b.CharacterBId : b.CharacterAId;
        const other = characters.find((c) => c.Id === otherId);
        return (
          <div key={b.Id} className={styles.connection}>
            <div className={styles.motifHead}>
              <span className={styles.motifName}>{other?.Name ?? 'Unknown'}</span>
              <Dots label={`Bond Track with ${other?.Name ?? 'Unknown'}`} count={bondLen} filled={b.BondTrack} />
            </div>
            <div className={styles.tagRow}>
              <span className={styles.small}>Connection Tag</span>
              <span>{b.ConnectionTag || '—'}</span>
            </div>
            {b.BondMoves.length > 0 && (
              <div className={styles.tagRow}>
                <span className={styles.small}>Connection Improvements</span>
                <span>{b.BondMoves.map((m, i) => <Fragment key={i}>{i > 0 ? ' · ' : ''}{plain(m.Text)}</Fragment>)}</span>
              </div>
            )}
          </div>
        );
      })}
    </Block>
  );
}

// ---------- Party Identity ----------

function PartyBlock({ party, blank: isBlank, plain }: { party: Party | null; blank: boolean; plain: Plain }) {
  const tags = (kind: 'Skill' | 'Flaw', list: string[]) =>
    list.map((t) => (party && isPartyTagUsed(party, kind, t) ? `${t} (used)` : t));
  return (
    <Block title="Party Identity">
      <div className={styles.tagRow}>
        <span className={styles.small}>Party Motif</span>
        {party ? <span>{party.Motif || '—'}</span> : <div className={styles.line} />}
      </div>
      <div className={styles.tagRow}>
        <span className={styles.small}>Skill Tags</span>
        {party ? <span>{party.SkillTags.length > 0 ? tags('Skill', party.SkillTags).join(' · ') : 'None'}</span> : <div className={styles.line} />}
      </div>
      <div className={styles.tagRow}>
        <span className={styles.small}>Flaw Tags</span>
        {party ? <span>{party.FlawTags.length > 0 ? tags('Flaw', party.FlawTags).join(' · ') : 'None'}</span> : <div className={styles.line} />}
      </div>
      <div className={styles.tagRow}>
        <span className={styles.small}>Party Quest</span>
        {party ? (
          <span>
            {plain(party.Quest) || '—'}
            {party.ActBreaks > 0 ? ` · ${party.ActBreaks} Act Break${party.ActBreaks === 1 ? '' : 's'}` : ''}
            {party.Forsakes > 0 ? ` · ${party.Forsakes} Forsake${party.Forsakes === 1 ? '' : 's'}` : ''}
          </span>
        ) : (
          <div className={styles.line} />
        )}
      </div>
      <Label>Camp Assets</Label>
      <List
        min={isBlank ? BLANK_CAMP_ASSETS : 0}
        empty="None yet."
        items={(party?.CampAssets ?? []).map((a) => (
          <>
            <strong>{a.Name}</strong> <span className={styles.small}>Tier {a.Tier}</span>
            {a.Effect ? <> — {plain(a.Effect)}</> : null}
          </>
        ))}
      />
    </Block>
  );
}

// ---------- Moves reference ----------

function groupKeyFor(m: Move): string {
  return m.VirtueId ?? (m.Kind === 'Adventure' ? 'adventure' : 'any');
}

function groupLabelFor(key: string, library: Library): string {
  if (key === 'adventure') return 'Adventure';
  if (key === 'any') return 'Any';
  return library.virtues.find((v) => v.Id === key)?.Name ?? key;
}

function MovesReference({ library, plain, full }: { library: Library; plain: Plain; full: boolean }) {
  // Same grouping and order as the Moves drawer: each Virtue's Moves, then Adventure, then Any.
  const shown = full ? library.moves : library.moves.filter((m) => m.Kind === 'Basic');
  const keys = [...library.virtues.map((v) => v.Id), 'adventure', 'any'].filter((k) => shown.some((m) => groupKeyFor(m) === k));
  return (
    <section className={styles.moves} aria-label="Moves reference">
      <h2 className={styles.movesTitle}>The Moves</h2>
      <div className={styles.moveColumns}>
        {keys.map((key) => (
          <Fragment key={key}>
            <h3 className={styles.moveGroup}>{groupLabelFor(key, library)}</h3>
            {shown
              .filter((m) => groupKeyFor(m) === key)
              .map((m) => (
                <article key={m.Id} className={styles.move}>
                  <h4 className={styles.moveName}>{m.Name}</h4>
                  <p className={styles.moveText}>{plain(m.Description)}</p>
                  {full && TIER_ORDER.map((k) => {
                    const r = m.Results[k];
                    return (
                      <div key={k} className={styles.moveTier}>
                        <span className={styles.moveTierLabel}>{TIER_LABELS[k]}</span> {plain(r.Description)}
                        {r.Options.length > 0 && (
                          <ul className={styles.moveOptions}>
                            {r.Options.map((o, i) => <li key={i}>{plain(o)}</li>)}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                  {full && m.PlayerVariantResults && (
                    <div className={styles.moveVariant}>
                      <span className={styles.moveTierLabel}>On a Player</span>
                      {TIER_ORDER.map((k) => (
                        <div key={k} className={styles.moveTier}>
                          <span className={styles.moveTierLabel}>{TIER_LABELS[k]}</span> {plain(m.PlayerVariantResults![k].Description)}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
