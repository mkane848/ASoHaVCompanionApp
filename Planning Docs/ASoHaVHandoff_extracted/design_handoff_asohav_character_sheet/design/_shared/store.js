/* ASoHaV play state — the single canonical store.
   Replaces the separate character-sheet and campaign stores, which each carried their own
   copy of characters / bonds / party and could disagree. There is now ONE dataset:
   the sheet reads a character's own sheet, the campaign shell reads all of them.

   Two datasets exist in the app overall, and the split is deliberate:
     · this file  — PLAY state (who exists, what they've done). Per campaign.
     · adminstore — the CONTENT LIBRARY (virtues, moves, items…). Authored, shared, read-only to players.

   OWNERSHIP RULE: this module holds no live state. load() returns the state object, the caller
   owns it, and every helper is pure — state in, value out. Survives hot reload with one source of truth. */
(function () {
  const KEY = 'asohav.v2.state';
  const uid = p => (p || 'x') + '-' + Math.random().toString(36).slice(2, 8);
  const now = () => new Date().toISOString();

  function _read() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function _write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { console.error('store: write failed', e); return false; } }

  function makeSheet(charId, o) {
    return {
      Id: 'sh-' + charId, CharacterId: charId,
      Looks: o.looks || '',
      Virtues: [
        { VirtueId: 'v-might', Score: o.v[0], ConditionMarked: (o.marked || []).indexOf('v-might') >= 0 },
        { VirtueId: 'v-mettle', Score: o.v[1], ConditionMarked: (o.marked || []).indexOf('v-mettle') >= 0 },
        { VirtueId: 'v-heart', Score: o.v[2], ConditionMarked: (o.marked || []).indexOf('v-heart') >= 0 },
        { VirtueId: 'v-wit', Score: o.v[3], ConditionMarked: (o.marked || []).indexOf('v-wit') >= 0 },
        { VirtueId: 'v-guile', Score: o.v[4], ConditionMarked: (o.marked || []).indexOf('v-guile') >= 0 }
      ],
      Statuses: o.statuses || [],
      Armor: o.armor || [],
      Theme: o.theme,
      Load: { Tier: o.loadTier || 'Normal', LatchedUntilCamp: false },
      Items: o.items || [],
      AbilityIds: o.abilities || [],
      SkillIds: o.skills || [],
      Advancement: { Potential: o.potential || 0, PotentialAdvancementsTaken: [], History: [] },
      CreatedAt: now(), UpdatedAt: now()
    };
  }

  function seed() {
    const c = 'cm-1';
    return {
      schemaVersion: 2,
      currentUserId: 'u-ryan',
      campaignId: c,
      campaigns: [{ Id: c, Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: now() }],
      users: [
        { Id: 'u-mike', Name: 'Mike' }, { Id: 'u-ryan', Name: 'Ryan' },
        { Id: 'u-sam', Name: 'Sam' }, { Id: 'u-ivy', Name: 'Ivy' }, { Id: 'u-dax', Name: 'Dax' }
      ],
      memberships: [
        { Id: 'mb-1', UserId: 'u-mike', CampaignId: c, Role: 'GM', CharacterId: null },
        { Id: 'mb-2', UserId: 'u-ryan', CampaignId: c, Role: 'Player', CharacterId: 'ch-ember' },
        { Id: 'mb-3', UserId: 'u-sam', CampaignId: c, Role: 'Player', CharacterId: 'ch-matryoshka' },
        { Id: 'mb-4', UserId: 'u-ivy', CampaignId: c, Role: 'Player', CharacterId: 'ch-oleander' },
        { Id: 'mb-5', UserId: 'u-dax', CampaignId: c, Role: 'Player', CharacterId: 'ch-frostbite' }
      ],
      invites: [{ Id: 'inv-1', CampaignId: c, Email: 'jules@example.com', Code: 'ROAD-7412', SentAt: now(), Status: 'Pending' }],
      characters: [
        { Id: 'ch-ember', Name: 'Ember', PlayerName: 'Ryan', UserId: 'u-ryan', CampaignId: c },
        { Id: 'ch-matryoshka', Name: 'Matryoshka', PlayerName: 'Sam', UserId: 'u-sam', CampaignId: c },
        { Id: 'ch-oleander', Name: 'Oleander', PlayerName: 'Ivy', UserId: 'u-ivy', CampaignId: c },
        { Id: 'ch-frostbite', Name: 'Frostbite', PlayerName: 'Dax', UserId: 'u-dax', CampaignId: c }
      ],
      party: {
        Id: 'pt-1', CampaignId: c, Rapport: 3, RapportAdvancementsTaken: [],
        History: [], UpdatedAt: now(), UpdatedBy: 'u-sam'
      },
      bonds: [
        { Id: 'bd-1', CharacterAId: 'ch-ember', CharacterBId: 'ch-matryoshka', KinTrack: 4, BondLevel: 1,
          BondMoves: [{ Level: 1, Text: 'When we fight back to back, the first hit against either of us hits neither.', AuthoredAt: now() }],
          PendingChange: null, History: [], UpdatedAt: now() },
        { Id: 'bd-2', CharacterAId: 'ch-ember', CharacterBId: 'ch-oleander', KinTrack: 2, BondLevel: 0, BondMoves: [],
          PendingChange: { Id: 'pc-1', ProposedBy: 'ch-oleander', Type: 'MarkKin', Payload: { Delta: 1 }, Note: 'You talked me down from the bridge.', ProposedAt: now() },
          History: [], UpdatedAt: now() },
        { Id: 'bd-3', CharacterAId: 'ch-ember', CharacterBId: 'ch-frostbite', KinTrack: 0, BondLevel: 0, BondMoves: [], PendingChange: null, History: [], UpdatedAt: now() },
        { Id: 'bd-4', CharacterAId: 'ch-matryoshka', CharacterBId: 'ch-oleander', KinTrack: 5, BondLevel: 2, BondMoves: [], PendingChange: null, History: [], UpdatedAt: now() },
        { Id: 'bd-5', CharacterAId: 'ch-matryoshka', CharacterBId: 'ch-frostbite', KinTrack: 1, BondLevel: 0, BondMoves: [], PendingChange: null, History: [], UpdatedAt: now() },
        { Id: 'bd-6', CharacterAId: 'ch-oleander', CharacterBId: 'ch-frostbite', KinTrack: 3, BondLevel: 1, BondMoves: [], PendingChange: null, History: [], UpdatedAt: now() }
      ],
      sheets: [
        makeSheet('ch-ember', {
          looks: 'Soot-stained coat, close-cropped hair, hands that never stop moving.',
          v: [1, 0, 2, 0, -1], marked: ['v-heart'], potential: 3, loadTier: 'Normal',
          theme: { ThemeId: 't-debt', AcceptedQuests: [
            { QuestId: 'q-debt-2', Completed: false, AcceptedAt: now() },
            { QuestId: 'q-debt-3', Completed: false, AcceptedAt: now() }] },
          statuses: [
            { Id: 'st-1', Name: 'Rattled', Rank: 2, Polarity: 'Negative', LinkedToIds: [], AffectedByIds: [] },
            { Id: 'st-2', Name: 'Prepared', Rank: 2, Polarity: 'Positive', LinkedToIds: [], AffectedByIds: [] },
            { Id: 'st-3', Name: 'Indebted to the ferryman', Rank: 1, Polarity: 'Negative', LinkedToIds: [], AffectedByIds: [] }],
          armor: [
            { Id: 'ar-1', ArmorTypeId: 'a-physical', Used: false, SourceId: 'ab-ironclad', SourceLabel: 'Ironclad' },
            { Id: 'ar-2', ArmorTypeId: 'a-physical', Used: true, SourceId: 'i-shield', SourceLabel: 'Kite shield' },
            { Id: 'ar-3', ArmorTypeId: 'a-special', Used: false, SourceId: 'i-wardstone', SourceLabel: 'Ward-stone' }],
          items: [
            { ItemId: 'i-sword', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-shield', Carried: true, ChargesUsed: 0 },
            { ItemId: 'i-bootknife', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-lantern', Carried: true, ChargesUsed: 1 },
            { ItemId: 'i-poultice', Carried: false, ChargesUsed: 2 }, { ItemId: 'i-rope', Carried: false, ChargesUsed: 0 },
            { ItemId: 'i-wardstone', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-rations', Carried: false, ChargesUsed: 0 }],
          abilities: ['ab-ironclad', 'ab-readall'], skills: ['s-protect']
        }),
        makeSheet('ch-matryoshka', {
          looks: 'Layered coats, nothing underneath you were meant to see.',
          v: [-1, 2, 0, 1, 0], marked: [], potential: 1, loadTier: 'Light',
          theme: { ThemeId: 't-exile', AcceptedQuests: [{ QuestId: 'q-exile-2', Completed: false, AcceptedAt: now() }] },
          statuses: [{ Id: 'st-m1', Name: 'Sharp', Rank: 1, Polarity: 'Positive', LinkedToIds: [], AffectedByIds: [] }],
          armor: [{ Id: 'ar-m1', ArmorTypeId: 'a-physical', Used: false, SourceId: 'ab-ironclad', SourceLabel: 'Ironclad' }],
          items: [{ ItemId: 'i-bootknife', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-toolkit', Carried: true, ChargesUsed: 1 }],
          abilities: ['ab-quiet'], skills: ['s-trained']
        }),
        makeSheet('ch-oleander', {
          looks: 'Tall, grey-eyed, a sword she has never once drawn in anger.',
          v: [0, -1, 1, 2, 0], marked: ['v-mettle', 'v-wit'], potential: 4, loadTier: 'Heavy',
          theme: { ThemeId: 't-oath', AcceptedQuests: [{ QuestId: 'q-oath-1', Completed: true, AcceptedAt: now() }, { QuestId: 'q-oath-2', Completed: false, AcceptedAt: now() }] },
          statuses: [
            { Id: 'st-o1', Name: 'Exposed', Rank: 3, Polarity: 'Negative', LinkedToIds: [], AffectedByIds: [] },
            { Id: 'st-o2', Name: 'Indebted to the ferryman', Rank: 1, Polarity: 'Negative', LinkedToIds: [], AffectedByIds: [] }],
          armor: [
            { Id: 'ar-o1', ArmorTypeId: 'a-heavy', Used: true, SourceId: 'i-mail', SourceLabel: 'Coat of mail' },
            { Id: 'ar-o2', ArmorTypeId: 'a-physical', Used: true, SourceId: 'i-shield', SourceLabel: 'Kite shield' }],
          items: [
            { ItemId: 'i-sword', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-mail', Carried: true, ChargesUsed: 0 },
            { ItemId: 'i-shield', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-banner', Carried: true, ChargesUsed: 0 },
            { ItemId: 'i-rations', Carried: true, ChargesUsed: 0 }],
          abilities: ['ab-ward'], skills: ['s-ward']
        }),
        makeSheet('ch-frostbite', {
          looks: 'Broad, quiet, carrying someone else’s axe.',
          v: [2, 1, -1, 0, 0], marked: ['v-might'], potential: 0, loadTier: 'Normal',
          theme: { ThemeId: 't-inheritance', AcceptedQuests: [{ QuestId: 'q-inh-1', Completed: false, AcceptedAt: now() }] },
          statuses: [],
          armor: [
            { Id: 'ar-f1', ArmorTypeId: 'a-heavy', Used: false, SourceId: 'i-mail', SourceLabel: 'Coat of mail' },
            { Id: 'ar-f2', ArmorTypeId: 'a-physical', Used: false, SourceId: 'ab-ironclad', SourceLabel: 'Ironclad' },
            { Id: 'ar-f3', ArmorTypeId: 'a-physical', Used: false, SourceId: 'i-shield', SourceLabel: 'Kite shield' }],
          items: [
            { ItemId: 'i-sword', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-mail', Carried: true, ChargesUsed: 0 },
            { ItemId: 'i-shield', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-rope', Carried: true, ChargesUsed: 0 }],
          abilities: ['ab-ironclad', 'ab-resolve'], skills: ['s-martyr']
        })
      ]
    };
  }

  const S = {
    async load() {
      let s = _read();
      if (!s || s.schemaVersion !== 2) { s = seed(); _write(s); }
      return s;
    },
    async save(s) { s.savedAt = now(); _write(s); return s; },
    async reset() { const s = seed(); _write(s); return s; },

    /* --- pure readers --- */
    membershipFor(s, userId) { return s.memberships.find(m => m.UserId === userId) || null; },
    isGM(s, userId) { const m = this.membershipFor(s, userId); return !!m && m.Role === 'GM'; },
    characterFor(s, userId) {
      const m = this.membershipFor(s, userId);
      return m && m.CharacterId ? s.characters.find(c => c.Id === m.CharacterId) || null : null;
    },
    sheetFor(s, charId) { return s.sheets.find(x => x.CharacterId === charId) || null; },
    bondsFor(s, charId) { return s.bonds.filter(b => b.CharacterAId === charId || b.CharacterBId === charId); },
    partnerOf(s, bond, charId) {
      const otherId = bond.CharacterAId === charId ? bond.CharacterBId : bond.CharacterAId;
      return s.characters.find(c => c.Id === otherId) || null;
    },

    /* Derived summary for the GM's live-peek — computed from the real sheet, never a second copy. */
    summaryFor(s, charId, lib) {
      const sh = this.sheetFor(s, charId);
      const ch = s.characters.find(c => c.Id === charId);
      if (!sh || !ch) return null;
      const conds = (lib && lib.conditions) || [];
      const marked = sh.Virtues.filter(v => v.ConditionMarked)
        .map(v => { const c = conds.find(x => x.VirtueId === v.VirtueId); return c ? c.Name : v.VirtueId; });
      const tier = ((lib && lib.loadTiers) || []).find(t => t.Key === sh.Load.Tier);
      const might = (sh.Virtues.find(v => v.VirtueId === 'v-might') || {}).Score || 0;
      const capacity = tier ? tier.Base + might : 0;
      const carried = sh.Items.filter(i => i.Carried).reduce((n, i) => {
        const it = ((lib && lib.items) || []).find(x => x.Id === i.ItemId);
        return n + (it ? it.LoadCost : 0);
      }, 0);
      const theme = ((lib && lib.themes) || []).find(t => t.Id === sh.Theme.ThemeId);
      return {
        Id: ch.Id, Name: ch.Name, PlayerName: ch.PlayerName,
        Theme: theme ? theme.Name : '—',
        Virtues: sh.Virtues, ConditionsMarked: marked,
        Statuses: sh.Statuses,
        Load: { Tier: sh.Load.Tier, Carried: carried, Capacity: capacity },
        Potential: sh.Advancement.Potential,
        ArmorReady: sh.Armor.filter(a => !a.Used).length,
        ArmorTotal: sh.Armor.length
      };
    },

    /* --- history --- */
    logAdvancement(s, charId, entry) {
      const sh = this.sheetFor(s, charId);
      if (!sh) return s;
      sh.Advancement.History = sh.Advancement.History || [];
      sh.Advancement.History.unshift(Object.assign({ Id: uid('h'), At: now() }, entry));
      return s;
    },
    logRapport(s, entry) {
      s.party.History = s.party.History || [];
      s.party.History.unshift(Object.assign({ Id: uid('h'), At: now() }, entry));
      return s;
    },
    logBond(s, bondId, entry) {
      const b = s.bonds.find(x => x.Id === bondId);
      if (!b) return s;
      b.History = b.History || [];
      b.History.unshift(Object.assign({ Id: uid('h'), At: now() }, entry));
      return s;
    },

    /* --- the Bond handshake. No expiry: a proposal stands until answered or withdrawn. --- */
    proposeBondChange(s, bondId, proposerCharId, type, payload, note) {
      const b = s.bonds.find(x => x.Id === bondId);
      if (!b) throw new Error('no such bond');
      if (b.PendingChange) throw new Error('That Bond already has a change awaiting confirmation.');
      b.PendingChange = { Id: uid('pc'), ProposedBy: proposerCharId, Type: type, Payload: payload || {}, Note: note || '', ProposedAt: now() };
      b.UpdatedAt = now();
      this.logBond(s, bondId, { Action: 'proposed', Type: type, By: proposerCharId, Note: note || '' });
      return this.save(s);
    },
    acceptBondChange(s, bondId, byCharId) {
      const b = s.bonds.find(x => x.Id === bondId);
      if (!b || !b.PendingChange) return this.save(s);
      const p = b.PendingChange;
      let detail = '';
      if (p.Type === 'MarkKin') { b.KinTrack = Math.min(5, b.KinTrack + (p.Payload.Delta || 1)); detail = 'Kin now ' + b.KinTrack; }
      if (p.Type === 'SpendKin') {
        b.KinTrack = b.KinTrack - (p.Payload.Delta || 1);
        if (b.KinTrack < 0) { b.BondLevel = Math.max(0, b.BondLevel - 1); b.KinTrack = 4; }
        detail = 'Kin now ' + b.KinTrack;
      }
      if (p.Type === 'ForgeBond') {
        b.BondLevel = Math.min(5, b.BondLevel + 1);
        b.KinTrack = 0;
        b.BondMoves = (b.BondMoves || []).concat([{ Level: b.BondLevel, Text: p.Payload.Text || '', AuthoredAt: now() }]);
        detail = 'Bond Level ' + b.BondLevel;
      }
      b.PendingChange = null;
      b.UpdatedAt = now();
      this.logBond(s, bondId, { Action: 'accepted', Type: p.Type, By: byCharId, Note: detail });
      return this.save(s);
    },
    rejectBondChange(s, bondId, byCharId, withdrawn) {
      const b = s.bonds.find(x => x.Id === bondId);
      if (b && b.PendingChange) {
        const p = b.PendingChange;
        b.PendingChange = null;
        b.UpdatedAt = now();
        this.logBond(s, bondId, { Action: withdrawn ? 'withdrawn' : 'rejected', Type: p.Type, By: byCharId, Note: '' });
      }
      return this.save(s);
    },

    invite(s, email) {
      s.invites.push({ Id: uid('inv'), CampaignId: s.campaignId, Email: email, Code: 'ROAD-' + Math.floor(1000 + Math.random() * 8999), SentAt: now(), Status: 'Pending' });
      return this.save(s);
    },
    revokeInvite(s, id) { s.invites = s.invites.filter(i => i.Id !== id); return this.save(s); },

    async exportJSON(s) { return JSON.stringify({ exportedAt: now(), app: 'asohav-play-state', state: s }, null, 2); },
    async importJSON(text) {
      const parsed = JSON.parse(text);
      const s = parsed.state || parsed;
      if (!s.sheets) throw new Error('Not an ASoHaV export — no sheets found.');
      return this.save(s);
    },
    newId: uid
  };

  window.ASoHaVStore = S;
})();
