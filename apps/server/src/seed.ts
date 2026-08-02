import { supabaseAdmin } from './supabase.js';
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

export async function runSeedIfEmpty() {
  if (!(await libraryExists())) {
    await saveLibrary(seedLibrary());
    console.log('[seed] content library seeded');
  }

  const { count, error: countError } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
  if (countError) throw countError;

  if (!count) {
    const specs: [keyof typeof SEED_USER_IDS, string, string, boolean][] = [
      ['mike', 'Mike', 'mike@asohav.dev', true],
      ['ryan', 'Ryan', 'ryan@asohav.dev', true],
      ['sam', 'Sam', 'sam@asohav.dev', false],
      ['ivy', 'Ivy', 'ivy@asohav.dev', false],
      ['dax', 'Dax', 'dax@asohav.dev', false],
    ];

    // Supabase Auth issues its own UUIDs on signup — the shared seed data's placeholder user
    // IDs (SEED_USER_IDS.mike = 'u-mike', ...) get remapped onto the real ones created here
    // before anything referencing them (campaign, memberships, characters) is inserted.
    const idFor: Record<string, string> = {};
    for (const [key, name, email, isAdmin] of specs) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error || !data.user) throw error ?? new Error(`Failed to create seed user ${email}`);
      idFor[SEED_USER_IDS[key]] = data.user.id;
      if (isAdmin) {
        const { error: adminError } = await supabaseAdmin.from('profiles').update({ is_admin: true }).eq('id', data.user.id);
        if (adminError) throw adminError;
      }
    }
    const remapUser = (userId: string) => idFor[userId] ?? userId;

    const campaign = seedCampaign();
    campaign.GmUserId = remapUser(campaign.GmUserId);
    await insertCampaign(campaign);

    for (const m of seedMemberships()) {
      m.UserId = remapUser(m.UserId);
      await insertMembership(m);
    }
    for (const c of seedCharacters()) {
      c.UserId = remapUser(c.UserId);
      await insertCharacter(c);
    }
    for (const s of seedSheets()) {
      await saveSheet(s);
    }

    const party = seedParty();
    if (party.UpdatedBy) party.UpdatedBy = remapUser(party.UpdatedBy);
    await saveParty(party);

    for (const b of seedBonds()) {
      await insertBond(b);
    }

    console.log('[seed] demo campaign "The Long Road South" seeded');
    console.log('[seed] dev accounts (password: %s):', DEV_PASSWORD);
    specs.forEach(([, name, email, isAdmin]) => console.log(`  ${email}  (${name}${isAdmin ? ', content admin' : ''})`));
  }
}
