import type { CampaignBootstrap, Connector, PersonalPlace, PlaceOfInterest, PlaceOfInterestType, World, WorldRegion } from '@asohav/shared';
import { newId } from '@asohav/shared';
import { useCommitWorld } from '../../lib/mutations.js';
import { TagList } from '../../components/TagList.js';
import { Field } from '../../components/form/Field.js';
import { Select } from '../../components/form/Select.js';
import { SectionHead } from '../../components/SectionHead.js';
import styles from './WorldPanel.module.css';

const PLACE_TYPES: { key: PlaceOfInterestType; label: string }[] = [
  { key: 'Area', label: 'Area' },
  { key: 'Settlement', label: 'Settlement' },
  { key: 'Landmark', label: 'Landmark' },
];

function RegionCard({ region, readOnly, onSave, onRemove }: { region: WorldRegion; readOnly: boolean; onSave: (r: WorldRegion) => void; onRemove: () => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <input
          aria-label="Region name"
          className={styles.cardName}
          defaultValue={region.Name}
          placeholder="Name this region…"
          disabled={readOnly}
          onBlur={(e) => onSave({ ...region, Name: e.target.value })}
        />
        {!readOnly && (
          <button type="button" className={`tap-inline ${styles.remove}`} onClick={onRemove} aria-label={`Remove ${region.Name || 'this region'}`}>
            &times;
          </button>
        )}
      </div>
      <textarea
        aria-label="Region description"
        className={styles.cardTextarea}
        defaultValue={region.Description}
        placeholder="Terrain type or political occupant…"
        disabled={readOnly}
        onBlur={(e) => onSave({ ...region, Description: e.target.value })}
      />
      <textarea
        aria-label="Region note"
        className={styles.cardTextarea}
        defaultValue={region.Note}
        placeholder="One interesting truth or rumor about it (optional)…"
        disabled={readOnly}
        onBlur={(e) => onSave({ ...region, Note: e.target.value })}
      />
    </div>
  );
}

function PlaceCard({ place, readOnly, onSave, onRemove }: { place: PlaceOfInterest; readOnly: boolean; onSave: (p: PlaceOfInterest) => void; onRemove: () => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <input
          aria-label="Place name"
          className={styles.cardName}
          defaultValue={place.Name}
          placeholder="Name this place…"
          disabled={readOnly}
          onBlur={(e) => onSave({ ...place, Name: e.target.value })}
        />
        {!readOnly && (
          <button type="button" className={`tap-inline ${styles.remove}`} onClick={onRemove} aria-label={`Remove ${place.Name || 'this place'}`}>
            &times;
          </button>
        )}
      </div>
      <Select aria-label="Place type" value={place.Type} disabled={readOnly} onChange={(e) => onSave({ ...place, Type: e.target.value as PlaceOfInterestType })}>
        {PLACE_TYPES.map((t) => (
          <option key={t.key} value={t.key}>{t.label}</option>
        ))}
      </Select>
      <textarea
        aria-label="Place description"
        className={styles.cardTextarea}
        defaultValue={place.Description}
        placeholder="What's interesting about it…"
        disabled={readOnly}
        onBlur={(e) => onSave({ ...place, Description: e.target.value })}
      />
    </div>
  );
}

function PersonalPlaceCard({ place, readOnly, onSave, onRemove }: { place: PersonalPlace; readOnly: boolean; onSave: (p: PersonalPlace) => void; onRemove: () => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <input
          aria-label="Personal place name"
          className={styles.cardName}
          defaultValue={place.Name}
          placeholder="Name this place…"
          disabled={readOnly}
          onBlur={(e) => onSave({ ...place, Name: e.target.value })}
        />
        {!readOnly && (
          <button type="button" className={`tap-inline ${styles.remove}`} onClick={onRemove} aria-label={`Remove ${place.Name || 'this place'}`}>
            &times;
          </button>
        )}
      </div>
      <textarea
        aria-label="Significant event"
        className={styles.cardTextarea}
        defaultValue={place.Event}
        placeholder="An event that happened here — a celebration, a tragedy, a catalyst…"
        disabled={readOnly}
        onBlur={(e) => onSave({ ...place, Event: e.target.value })}
      />
    </div>
  );
}

function ConnectorCard({ connector, readOnly, onSave, onRemove }: { connector: Connector; readOnly: boolean; onSave: (c: Connector) => void; onRemove: () => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <input
          aria-label="Connector name"
          className={styles.cardName}
          defaultValue={connector.Name}
          placeholder="Name this connector…"
          disabled={readOnly}
          onBlur={(e) => onSave({ ...connector, Name: e.target.value })}
        />
        {!readOnly && (
          <button type="button" className={`tap-inline ${styles.remove}`} onClick={onRemove} aria-label={`Remove ${connector.Name || 'this connector'}`}>
            &times;
          </button>
        )}
      </div>
      <textarea
        aria-label="Connector description"
        className={styles.cardTextarea}
        defaultValue={connector.Description}
        placeholder="A road, a river, a secret path, a ley line — where does it go…"
        disabled={readOnly}
        onBlur={(e) => onSave({ ...connector, Description: e.target.value })}
      />
    </div>
  );
}

/** Ruleset-V0.6.md's "Creating the World" chapter (V0.6 slice 8) — CATS plus a five-step (really
 *  six-section, see `World`'s own doc comment) collaborative map build. Any campaign member may
 *  edit anything here; there's no per-player turn enforcement (the doc's own "starting with
 *  whoever wants to speak" turn suggestions are a table convention, not something this
 *  track-and-display app enforces, the same treatment Combat's turn order already gets). */
export function WorldPanel({ campaignId, boot }: { campaignId: string; boot: CampaignBootstrap }) {
  const world = boot.world;
  const commit = useCommitWorld(campaignId);
  const archived = boot.campaign.Status === 'Archived';

  function set<K extends keyof World>(key: K, value: World[K]) {
    commit((d) => { d[key] = value; });
  }

  function setStartingPlace<K extends keyof World['StartingPlace']>(key: K, value: World['StartingPlace'][K]) {
    commit((d) => { d.StartingPlace[key] = value; });
  }

  return (
    <div className={styles.panel}>
      {archived && <p className={styles.archivedNote}>This campaign is archived — the World is frozen until it's unarchived.</p>}

      <SectionHead title="CATS" />
      <p className={`prose ${styles.hint}`}>
        Concept, Aim, Tone, Subject Matter — a short conversation to set expectations before you start building. Work through them in order.
      </p>
      <div className={styles.catsGrid}>
        <Field label="Concept" htmlFor="world-concept">
          <textarea id="world-concept" className={styles.textarea} defaultValue={world.Concept} disabled={archived} placeholder="What's this game, at a high level?" onBlur={(e) => set('Concept', e.target.value)} />
        </Field>
        <Field label="Aim" htmlFor="world-aim">
          <textarea id="world-aim" className={styles.textarea} defaultValue={world.Aim} disabled={archived} placeholder="What kind of story are you trying to tell?" onBlur={(e) => set('Aim', e.target.value)} />
        </Field>
        <Field label="Tone" htmlFor="world-tone">
          <textarea id="world-tone" className={styles.textarea} defaultValue={world.Tone} disabled={archived} placeholder="Serious vs. silly, action vs. drama…" onBlur={(e) => set('Tone', e.target.value)} />
        </Field>
        <Field label="Subject Matter" htmlFor="world-subject-matter">
          <textarea id="world-subject-matter" className={styles.textarea} defaultValue={world.SubjectMatter} disabled={archived} placeholder="What ideas might come up? Any boundaries?" onBlur={(e) => set('SubjectMatter', e.target.value)} />
        </Field>
      </div>

      <SectionHead title="Step 1 — Where the Adventure Begins" spaced />
      <Field label="Place name" htmlFor="world-place-name">
        <input id="world-place-name" className={styles.input} defaultValue={world.StartingPlace.Name} disabled={archived} placeholder="Kaimora, Hillshire, the Forgotten Mausoleum…" onBlur={(e) => setStartingPlace('Name', e.target.value)} />
      </Field>
      <p className={styles.groupLabel}>Local details — one per player</p>
      <TagList
        items={world.StartingPlace.Details}
        onChange={(next) => setStartingPlace('Details', next)}
        addLabel="+ Detail"
        placeholder="A mysterious lighthouse, a thick forest…"
        ariaPrefix="Local detail"
        emptyText="No details yet."
      />
      <div className={styles.promptGrid}>
        <Field label="This place is famous for" htmlFor="world-famous-for">
          <input id="world-famous-for" className={styles.input} defaultValue={world.StartingPlace.FamousFor} disabled={archived} onBlur={(e) => setStartingPlace('FamousFor', e.target.value)} />
        </Field>
        <Field label="It is infamous for" htmlFor="world-infamous-for">
          <input id="world-infamous-for" className={styles.input} defaultValue={world.StartingPlace.InfamousFor} disabled={archived} onBlur={(e) => setStartingPlace('InfamousFor', e.target.value)} />
        </Field>
        <Field label="Its resources (natural or economic) are…" htmlFor="world-resource-situation">
          <input id="world-resource-situation" className={styles.input} defaultValue={world.StartingPlace.ResourceSituation} disabled={archived} placeholder="Prospering, floundering, etc." onBlur={(e) => setStartingPlace('ResourceSituation', e.target.value)} />
        </Field>
        <Field label="Because of that, one thing happening here is" htmlFor="world-resource-consequence">
          <input id="world-resource-consequence" className={styles.input} defaultValue={world.StartingPlace.ResourceConsequence} disabled={archived} onBlur={(e) => setStartingPlace('ResourceConsequence', e.target.value)} />
        </Field>
        <Field label="A notable organization or group that calls it home" htmlFor="world-notable-org">
          <input id="world-notable-org" className={styles.input} defaultValue={world.StartingPlace.NotableOrganization} disabled={archived} onBlur={(e) => setStartingPlace('NotableOrganization', e.target.value)} />
        </Field>
        <Field label="The nearest neighboring town" htmlFor="world-nearest-neighbor">
          <input id="world-nearest-neighbor" className={styles.input} defaultValue={world.StartingPlace.NearestNeighbor} disabled={archived} onBlur={(e) => setStartingPlace('NearestNeighbor', e.target.value)} />
        </Field>
        <Field label="That town's relationship with this place" htmlFor="world-neighbor-relationship">
          <input id="world-neighbor-relationship" className={styles.input} defaultValue={world.StartingPlace.NeighborRelationship} disabled={archived} placeholder="Amicable, competitive, envious, charitable, etc." onBlur={(e) => setStartingPlace('NeighborRelationship', e.target.value)} />
        </Field>
      </div>
      <p className={styles.groupLabel}>Rumors about this place — one per player</p>
      <TagList
        items={world.StartingPlace.Rumors}
        onChange={(next) => setStartingPlace('Rumors', next)}
        addLabel="+ Rumor"
        placeholder="A bit of everyday drama, or something supernatural…"
        ariaPrefix="Starting-place rumor"
        emptyText="No rumors yet."
      />

      <SectionHead title="Step 2 — The Surrounding Regions" spaced />
      <p className={`prose ${styles.hint}`}>A big section of land or water — by terrain, by who occupies it, or both. The first should overlap your starting place.</p>
      {world.Regions.map((r) => (
        <RegionCard key={r.Id} region={r} readOnly={archived} onSave={(next) => commit((d) => { d.Regions = d.Regions.map((x) => (x.Id === next.Id ? next : x)); })} onRemove={() => commit((d) => { d.Regions = d.Regions.filter((x) => x.Id !== r.Id); })} />
      ))}
      {!archived && (
        <button type="button" className={`tap-inline ${styles.addButton}`} onClick={() => commit((d) => { d.Regions.push({ Id: newId('rg'), Name: '', Description: '', Note: '' }); })}>
          + Region
        </button>
      )}

      <SectionHead title="Step 3 — Places of Interest" spaced />
      <p className={`prose ${styles.hint}`}>Areas, Settlements, or Landmarks — specific places the party may visit, near or far.</p>
      {world.PlacesOfInterest.map((p) => (
        <PlaceCard key={p.Id} place={p} readOnly={archived} onSave={(next) => commit((d) => { d.PlacesOfInterest = d.PlacesOfInterest.map((x) => (x.Id === next.Id ? next : x)); })} onRemove={() => commit((d) => { d.PlacesOfInterest = d.PlacesOfInterest.filter((x) => x.Id !== p.Id); })} />
      ))}
      {!archived && (
        <button type="button" className={`tap-inline ${styles.addButton}`} onClick={() => commit((d) => { d.PlacesOfInterest.push({ Id: newId('poi'), Type: 'Settlement', Name: '', Description: '' }); })}>
          + Place of Interest
        </button>
      )}

      <SectionHead title="Step 4 — Personal Places" spaced />
      <p className={`prose ${styles.hint}`}>A place each player's character calls home, or one that holds real significance to them — plus the event that made it matter.</p>
      {world.PersonalPlaces.map((p) => (
        <PersonalPlaceCard key={p.Id} place={p} readOnly={archived} onSave={(next) => commit((d) => { d.PersonalPlaces = d.PersonalPlaces.map((x) => (x.Id === next.Id ? next : x)); })} onRemove={() => commit((d) => { d.PersonalPlaces = d.PersonalPlaces.filter((x) => x.Id !== p.Id); })} />
      ))}
      {!archived && (
        <button type="button" className={`tap-inline ${styles.addButton}`} onClick={() => commit((d) => { d.PersonalPlaces.push({ Id: newId('pp'), Name: '', Event: '' }); })}>
          + Personal Place
        </button>
      )}

      <SectionHead title="Step 5 — Create Connectors" spaced />
      <p className={`prose ${styles.hint}`}>Anything that gets people or things from A to B — a road, a river, a secret path, a ley line. Aim for five or so.</p>
      {world.Connectors.map((c) => (
        <ConnectorCard key={c.Id} connector={c} readOnly={archived} onSave={(next) => commit((d) => { d.Connectors = d.Connectors.map((x) => (x.Id === next.Id ? next : x)); })} onRemove={() => commit((d) => { d.Connectors = d.Connectors.filter((x) => x.Id !== c.Id); })} />
      ))}
      {!archived && (
        <button type="button" className={`tap-inline ${styles.addButton}`} onClick={() => commit((d) => { d.Connectors.push({ Id: newId('con'), Name: '', Description: '' }); })}>
          + Connector
        </button>
      )}

      <SectionHead title="Step 6 — Start Rumors" spaced />
      <p className={`prose ${styles.hint}`}>A rumor your character has heard about any place on the map — true, false, or somewhere in between.</p>
      <TagList
        items={world.Rumors}
        onChange={(next) => set('Rumors', next)}
        addLabel="+ Rumor"
        placeholder="Something worth chasing down…"
        ariaPrefix="World rumor"
        emptyText="No rumors yet."
      />
    </div>
  );
}
