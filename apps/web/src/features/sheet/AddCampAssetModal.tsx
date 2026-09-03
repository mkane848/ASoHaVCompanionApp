import { useState } from 'react';
import type { Library, PartyCampAsset } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './PartyPlaybookPanel.module.css';

/** Adding a Camp Asset is a hybrid pick: a text input backed by a native `<datalist>` of
 *  `library.campAssets` names (an accessible, dependency-free "autocomplete, but freeSolo" —
 *  typing a name that matches the catalog autofills Description/Tier/Effect from it and links
 *  `RefId`; typing anything else stays a fully custom entry, `RefId: ''`). Deliberately doesn't
 *  offer "save this back to the library" the way Combat's ad-hoc Enemy flow does — that goes
 *  through an admin-only write route (`requireAdmin`), and Make Camp is something any player can
 *  run, not just a GM who may also hold an admin account.
 *
 *  Split into its own file and lazy-loaded from `PartyPlaybookPanel.tsx` (a rarely-opened modal
 *  on an otherwise always-rendered panel) — see `CharacterSheetPage.tsx`'s bundle-budget note. */
export function AddCampAssetModal({ library, onAdd, onClose }: { library: Library; onAdd: (asset: Omit<PartyCampAsset, 'Id'>) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState(1);
  const [effect, setEffect] = useState('');
  const [refId, setRefId] = useState('');

  function pickName(v: string) {
    setName(v);
    const match = library.campAssets.find((a) => a.Name.toLowerCase() === v.trim().toLowerCase());
    if (match) {
      setRefId(match.Id);
      setDescription(match.Description);
      setTier(match.Tier);
      setEffect(match.Effect);
    } else {
      setRefId('');
    }
  }

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="camp-asset-title" tabIndex={-1}>
        <div className={modal.head}>
          <h2 id="camp-asset-title" className={modal.title}>Add a Camp Asset</h2>
        </div>
        <div className={modal.body}>
          <input
            className={`tap-inline ${styles.fieldInput}`}
            list="camp-asset-options"
            aria-label="Camp Asset name"
            value={name}
            placeholder="Type a name — pick from the list, or write your own"
            onChange={(e) => pickName(e.target.value)}
          />
          <datalist id="camp-asset-options">
            {library.campAssets.map((a) => (
              <option key={a.Id} value={a.Name} />
            ))}
          </datalist>
          <textarea aria-label="Description" className={`tap-inline ${styles.fieldTextarea}`} value={description} placeholder="Description…" onChange={(e) => setDescription(e.target.value)} />
          <div className={styles.tierRow}>
            <label className={styles.fieldLabel}>Tier</label>
            <input type="number" min={1} aria-label="Tier" className={`tap-inline ${styles.tierInput}`} value={tier} onChange={(e) => setTier(Math.max(1, parseInt(e.target.value, 10) || 1))} />
          </div>
          <textarea aria-label="Effect" className={`tap-inline ${styles.fieldTextarea}`} value={effect} placeholder="Effect…" onChange={(e) => setEffect(e.target.value)} />
          <div className={`action-grid ${styles.dialogActions}`}>
            <button type="button" className={`tap-inline ${modal.secondaryAction}`} onClick={onClose}>Cancel</button>
            <button
              type="button"
              className={`tap-inline ${modal.primaryAction}`}
              disabled={!name.trim()}
              onClick={() => onAdd({ RefId: refId, Name: name.trim(), Description: description.trim(), Tier: tier, Effect: effect.trim() })}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
