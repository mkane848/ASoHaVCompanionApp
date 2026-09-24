import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import { newId } from '@asohav/shared';
import type { Library, Party, PartyCampAsset } from '@asohav/shared';
import { isPartyTagUsed } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './PartyPlaybookPanel.module.css';
import typography from '../../styles/typography.module.css';

// Lazy — a rarely-opened modal on an otherwise always-rendered panel, same bundle-budget
// reasoning as CharacterSheetPage.tsx's four guided-flow modals.
const AddCampAssetModal = lazy(() => import('./AddCampAssetModal.js').then((m) => ({ default: m.AddCampAssetModal })));

/** Read-only summary of the Party's identity (Motif, Skill/Flaw Tags, Quest, Party Improvements)
 *  plus its Camp Assets. The party's identity is edited on the Party page (revised V0.6, slice 4).
 *  Lives on the sheet, matching where Rapport and Bonds already live (`AdvancementPanel`,
 *  `ConnectionsPanel`) despite being party-shared data; editing redirects to the dedicated page.
 *  Kept its `0.34.0` file/component name (`PartyPlaybookPanel`) even after the "Party Playbook"
 *  framing was retired — a wording correction, not a code change. */
export function PartyPlaybookPanel({ party, library, commitParty }: { party: Party; library: Library; commitParty: (m: (d: Party) => void) => void }) {
  const matcher = useGlossaryMatcher();
  const [addingAsset, setAddingAsset] = useState(false);

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
      <p className={`prose ${styles.hint}`}>
        Shared across the whole party — <Link to={`/c/${party.CampaignId}/party`} className={`tap-inline ${styles.editLink}`}>Edit the Party</Link>
      </p>

      {/* Motif and Tags Summary */}
      <div className={styles.summary}>
        {party.Motif && (
          <div className={styles.motifBlock}>
            <div className={typography.label}>Party Motif</div>
            <div className={styles.motifName}>{party.Motif}</div>
          </div>
        )}

        <div className={styles.tagsBlock}>
          {party.SkillTags.length > 0 && (
            <div className={styles.tagCategory}>
              <div className={typography.label}>Skill Tags</div>
              <div className={styles.tagList}>
                {party.SkillTags.map((tag, i) => {
                  const used = isPartyTagUsed(party, 'Skill', tag);
                  return (
                    <div key={i} className={styles.tag}>
                      {tag} {used && <span className={styles.used}>(used)</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {party.FlawTags.length > 0 && (
            <div className={styles.tagCategory}>
              <div className={typography.label}>Flaw Tags</div>
              <div className={styles.tagList}>
                {party.FlawTags.map((tag, i) => {
                  const used = isPartyTagUsed(party, 'Flaw', tag);
                  return (
                    <div key={i} className={styles.tag}>
                      {tag} {used && <span className={styles.used}>(used)</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Quest Summary */}
        {party.Quest && (
          <div className={styles.questBlock}>
            <div className={typography.label}>Party Quest</div>
            <div className={styles.questText}>{party.Quest}</div>
            {party.ActBreaks > 0 && <div className={styles.meta}>{party.ActBreaks} Act Break{party.ActBreaks === 1 ? '' : 's'}</div>}
            {party.Forsakes > 0 && <div className={styles.meta}>{party.Forsakes} Forsake{party.Forsakes === 1 ? '' : 's'}</div>}
          </div>
        )}

        {/* Party Improvements */}
        {party.RapportImprovementsTaken.length > 0 && (
          <div className={styles.improvementsBlock}>
            <div className={typography.label}>Party Improvements</div>
            <div className={styles.improvementsList}>
              {party.RapportImprovementsTaken.map((imp, i) => (
                <div key={i} className={styles.improvement}>
                  {imp.Name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.campAssetsBlock}>
        <div className={typography.label}>Camp Assets</div>
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
        <button type="button" className={`tap-inline ${styles.addAsset}`} onClick={() => setAddingAsset(true)}>+ Camp Asset</button>
      </div>

      {addingAsset && (
        <Suspense fallback={null}>
          <AddCampAssetModal library={library} onAdd={addCampAsset} onClose={() => setAddingAsset(false)} />
        </Suspense>
      )}
    </Panel>
  );
}


