import { lazy, Suspense, useState } from 'react';
import { newId } from '@asohav/shared';
import type { Library, Party, PartyCampAsset } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './PartyPlaybookPanel.module.css';

// Lazy — a rarely-opened modal on an otherwise always-rendered panel, same bundle-budget
// reasoning as CharacterSheetPage.tsx's four guided-flow modals.
const AddCampAssetModal = lazy(() => import('./AddCampAssetModal.js').then((m) => ({ default: m.AddCampAssetModal })));

/** The party's own shared identity (Ruleset-V0.5.md, "Define your Party Motif + Quest" / "Party
 *  Advancement — Rapport"), plus its Camp Assets — slice 7. No structured catalog exists for any
 *  of this in the source document (see `Party`'s doc comment in `types.ts`) — nor will one:
 *  Playbooks aren't part of the game's systems at all, confirmed directly by the repo owner — so
 *  Motif/Quest/Path/Goal are freeform text any party member can edit, the same treatment Bond
 *  Moves got before any catalog existed for those either. Lives on the sheet, not the Campaign
 *  Shell, matching where Rapport and Bonds already live (`AdvancementPanel`) despite being
 *  party-shared data too. Kept its `0.34.0` file/component name (`PartyPlaybookPanel`) even after
 *  the "Party Playbook" framing was retired from prose elsewhere — a wording correction, not a
 *  code change; see `CLAUDE.md`'s "Architecture: Party Identity & Camp" section. */
export function PartyPlaybookPanel({ party, library, commitParty }: { party: Party; library: Library; commitParty: (m: (d: Party) => void) => void }) {
  const matcher = useGlossaryMatcher();
  const [addingAsset, setAddingAsset] = useState(false);

  function setField(field: 'Motif' | 'Quest' | 'Path' | 'Goal', value: string) {
    commitParty((d) => { d[field] = value.trim(); });
  }

  function addTag(field: 'SkillTags' | 'WeaknessTags') {
    commitParty((d) => { d[field].push(''); });
  }

  function updateTag(field: 'SkillTags' | 'WeaknessTags', i: number, value: string) {
    commitParty((d) => { d[field][i] = value.trim(); });
  }

  function removeTag(field: 'SkillTags' | 'WeaknessTags', i: number) {
    commitParty((d) => { d[field].splice(i, 1); });
  }

  function addCampAsset(asset: Omit<PartyCampAsset, 'Id'>) {
    commitParty((d) => { d.CampAssets.push({ Id: newId('pca'), ...asset }); });
    setAddingAsset(false);
  }

  function removeCampAsset(id: string) {
    commitParty((d) => { d.CampAssets = d.CampAssets.filter((a) => a.Id !== id); });
  }

  return (
    <Panel id="p-party" collapseId="party" primary>
      <PanelHeader>Party Identity</PanelHeader>
      <p className={`prose ${styles.hint}`}>Shared across the whole party — anyone can edit this, and it updates for everyone at once.</p>

      <div className={styles.fieldGrid}>
        <TextField label="Party Motif" value={party.Motif} placeholder="Who are we, together?" onBlur={(v) => setField('Motif', v)} />
        <TextField label="Party Quest" value={party.Quest} placeholder="A short sentence…" onBlur={(v) => setField('Quest', v)} />
        <TextField label="Party Goal" value={party.Goal} placeholder="What are we hoping to accomplish right now?" onBlur={(v) => setField('Goal', v)} />
        <TextField
          label="Party Path"
          value={party.Path}
          placeholder="A question that leads our playstyle — asked again at End the Session…"
          onBlur={(v) => setField('Path', v)}
        />
      </div>

      <div className={styles.tagGroup}>
        <div className={styles.tagLabel}>Party Skill Tags</div>
        {party.SkillTags.map((tag, i) => (
          <TagRow key={i} value={tag} aria={`Party Skill Tag ${i + 1}`} onBlur={(v) => updateTag('SkillTags', i, v)} onRemove={() => removeTag('SkillTags', i)} />
        ))}
        <button type="button" className={`tap-inline ${styles.addTag}`} onClick={() => addTag('SkillTags')}>+ Skill Tag</button>
      </div>

      <div className={styles.tagGroup}>
        <div className={styles.tagLabel}>Party Weakness Tags</div>
        {party.WeaknessTags.map((tag, i) => (
          <TagRow key={i} value={tag} aria={`Party Weakness Tag ${i + 1}`} onBlur={(v) => updateTag('WeaknessTags', i, v)} onRemove={() => removeTag('WeaknessTags', i)} />
        ))}
        <button type="button" className={`tap-inline ${styles.addTag}`} onClick={() => addTag('WeaknessTags')}>+ Weakness Tag</button>
      </div>

      <div className={styles.campAssetsBlock}>
        <div className={styles.tagLabel}>Camp Assets</div>
        {party.CampAssets.length === 0 && <p className={styles.empty}>None yet — pick one at Camp.</p>}
        {party.CampAssets.map((a) => (
          <div key={a.Id} className={styles.campAsset}>
            <div className={styles.campAssetHead}>
              <span className={styles.campAssetName}>{a.Name}</span>
              <span className={styles.campAssetTier}>Tier {a.Tier}</span>
              <button type="button" className={`tap-inline ${styles.removeAsset}`} onClick={() => removeCampAsset(a.Id)} aria-label={`Remove ${a.Name}`}>&times;</button>
            </div>
            {a.Effect && <div className={styles.campAssetEffect}><GlossaryText text={a.Effect} matcher={matcher} /></div>}
          </div>
        ))}
        <button type="button" className={`tap-inline ${styles.addTag}`} onClick={() => setAddingAsset(true)}>+ Camp Asset</button>
      </div>

      {addingAsset && (
        <Suspense fallback={null}>
          <AddCampAssetModal library={library} onAdd={addCampAsset} onClose={() => setAddingAsset(false)} />
        </Suspense>
      )}
    </Panel>
  );
}

function TextField({ label, value, placeholder, onBlur }: { label: string; value: string; placeholder: string; onBlur: (v: string) => void }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <input
        aria-label={label}
        className={`tap-inline ${styles.fieldInput}`}
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => onBlur(e.target.value)}
      />
    </div>
  );
}

function TagRow({ value, aria, onBlur, onRemove }: { value: string; aria: string; onBlur: (v: string) => void; onRemove: () => void }) {
  return (
    <div className={styles.tagRow}>
      <input aria-label={aria} className={`tap-inline ${styles.tagInput}`} defaultValue={value} placeholder="Write a tag…" onBlur={(e) => onBlur(e.target.value)} />
      <button type="button" className={`tap-inline ${styles.removeTag}`} onClick={onRemove} aria-label={`Remove ${value || 'tag'}`}>&times;</button>
    </div>
  );
}

