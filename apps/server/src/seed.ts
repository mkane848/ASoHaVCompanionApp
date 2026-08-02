import { db } from './db.js';
import { createUser } from './auth.js';
import {
  seedLibrary,
  seedCampaign,
  seedMemberships,
  seedCharacters,
  seedSheets,
  seedParty,
  seedBonds,
  SEED_USER_IDS,
} from '@asohav/shared';
import {
  libraryExists,
  saveLibrary,
  insertCampaign,
  insertMembership,
  insertCharacter,
  saveSheet,
  saveParty,
  insertBond,
} from './repo.js';

const DEV_PASSWORD = 'asohav-dev';

export function runSeedIfEmpty() {
  if (!libraryExists()) {
    saveLibrary(seedLibrary());
    console.log('[seed] content library seeded');
  }

  const userCount = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
  if (userCount === 0) {
    const specs: [keyof typeof SEED_USER_IDS, string, string, boolean][] = [
      ['mike', 'Mike', 'mike@asohav.dev', true],
      ['ryan', 'Ryan', 'ryan@asohav.dev', true],
      ['sam', 'Sam', 'sam@asohav.dev', false],
      ['ivy', 'Ivy', 'ivy@asohav.dev', false],
      ['dax', 'Dax', 'dax@asohav.dev', false],
    ];
    for (const [key, name, email, isAdmin] of specs) {
      const wantId = SEED_USER_IDS[key];
      const u = createUser(name, email, DEV_PASSWORD, isAdmin);
      // createUser generates its own id; rewrite it to match the seed play-state ids so
      // memberships/characters (which reference u-mike, u-ryan, ...) line up.
      db.prepare('UPDATE users SET id = ? WHERE id = ?').run(wantId, u.id);
    }

    const campaign = seedCampaign();
    insertCampaign(campaign);
    seedMemberships().forEach(insertMembership);
    seedCharacters().forEach(insertCharacter);
    seedSheets().forEach(saveSheet);
    saveParty(seedParty());
    seedBonds().forEach(insertBond);

    console.log('[seed] demo campaign "The Long Road South" seeded');
    console.log('[seed] dev accounts (password: %s):', DEV_PASSWORD);
    specs.forEach(([, name, email, isAdmin]) => console.log(`  ${email}  (${name}${isAdmin ? ', content admin' : ''})`));
  }
}
