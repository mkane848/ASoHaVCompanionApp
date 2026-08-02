/* Admin-side storage for the content library.
   Seeds from library.js, persists edits to localStorage, and appends every write to a change log.
   Same discipline as the sheet's store.js: one module owns persistence, every method async,
   so the eventual server swap touches this file alone. */
(function () {
  const NS = 'asohav.v1.admin.';
  const uid = p => (p || 'x') + '-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  const now = () => new Date().toISOString();
  const clone = o => JSON.parse(JSON.stringify(o));

  function _read(k) {
    try { const r = localStorage.getItem(NS + k); return r ? JSON.parse(r) : null; }
    catch (e) { console.warn('adminStore: unreadable', k, e); return null; }
  }
  function _write(k, v) {
    try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; }
    catch (e) { console.error('adminStore: write failed', k, e); return false; }
  }

  const COLLECTIONS = ['virtues', 'conditions', 'armorTypes', 'items', 'themes', 'quests', 'skills', 'advancements', 'abilities', 'moves'];

  function seedLibrary() {
    const L = window.ASoHaVLibrary || {};
    const out = { settings: clone(L.settings || {}), loadTiers: clone(L.loadTiers || []) };
    COLLECTIONS.forEach(k => { out[k] = clone(L[k] || []); });
    return out;
  }

  const Store = {
    _lib: null, _log: null, _editor: null,

    async load() {
      if (!this._lib) {
        this._lib = _read('library') || seedLibrary();
        if (!_read('library')) _write('library', this._lib);
      }
      if (!this._log) this._log = _read('changelog') || [];
      if (!this._editor) this._editor = _read('editor') || 'Unassigned';
      return { library: this._lib, log: this._log, editor: this._editor };
    },

    setEditor(name) { this._editor = name; _write('editor', name); },

    list(collection) { return (this._lib && this._lib[collection]) || []; },
    find(collection, id) { return this.list(collection).find(x => x.Id === id) || null; },

    _persist() { _write('library', this._lib); _write('changelog', this._log); },

    _logChange(action, collection, obj, before, after) {
      this._log.unshift({
        Id: uid('log'), At: now(), Who: this._editor,
        Action: action, Collection: collection,
        ObjectId: obj.Id, ObjectName: obj.Name || obj.Id,
        Before: before ? clone(before) : null,
        After: after ? clone(after) : null
      });
      if (this._log.length > 500) this._log.length = 500;
    },

    async create(collection, prefix, values) {
      const obj = Object.assign({ Id: uid(prefix) }, values);
      this._lib[collection] = this._lib[collection] || [];
      this._lib[collection].push(obj);
      this._logChange('create', collection, obj, null, obj);
      this._persist();
      return obj;
    },

    async update(collection, id, values) {
      const arr = this._lib[collection] || [];
      const i = arr.findIndex(x => x.Id === id);
      if (i < 0) throw new Error('not found: ' + collection + '/' + id);
      const before = clone(arr[i]);
      arr[i] = Object.assign({}, arr[i], values);
      this._logChange('update', collection, arr[i], before, arr[i]);
      this._persist();
      return arr[i];
    },

    async remove(collection, id) {
      const arr = this._lib[collection] || [];
      const i = arr.findIndex(x => x.Id === id);
      if (i < 0) return null;
      const before = clone(arr[i]);
      arr.splice(i, 1);
      this._logChange('delete', collection, before, before, null);
      this._persist();
      return before;
    },

    async updateSettings(values) {
      const before = clone(this._lib.settings || {});
      this._lib.settings = Object.assign({}, this._lib.settings, values);
      this._logChange('update', 'settings', { Id: 'settings', Name: 'Game settings' }, before, this._lib.settings);
      this._persist();
      return this._lib.settings;
    },

    /* Field-level diff for the history view. */
    diff(entry) {
      const a = entry.Before || {}, b = entry.After || {};
      const keys = Object.keys(Object.assign({}, a, b)).filter(k => k !== 'Id');
      const out = [];
      keys.forEach(k => {
        const av = JSON.stringify(a[k]), bv = JSON.stringify(b[k]);
        if (av !== bv) out.push({ field: k, before: av === undefined ? '—' : av, after: bv === undefined ? '—' : bv });
      });
      return out;
    },

    /* Every ref field that points at something that no longer exists. */
    validate() {
      const S = window.ASoHaVSchema;
      const issues = [];
      if (!S) return issues;
      S.collections.forEach(col => {
        (this._lib[col.key] || []).forEach(obj => {
          col.fields.forEach(f => {
            if (f.type === 'ref' && obj[f.name]) {
              if (!this.find(f.collection, obj[f.name])) {
                issues.push({ collection: col.key, label: col.label, objectId: obj.Id, objectName: obj.Name || obj.Id, message: (f.label || f.name) + ' points at a missing ' + f.collection + ' (' + obj[f.name] + ')' });
              }
            }
            if (f.type === 'multiref' && Array.isArray(obj[f.name])) {
              obj[f.name].forEach(rid => {
                if (!this.find(f.collection, rid)) {
                  issues.push({ collection: col.key, label: col.label, objectId: obj.Id, objectName: obj.Name || obj.Id, message: (f.label || f.name) + ' includes a missing ' + f.collection + ' (' + rid + ')' });
                }
              });
            }
            if (f.required && !obj[f.name]) {
              issues.push({ collection: col.key, label: col.label, objectId: obj.Id, objectName: obj.Name || obj.Id, message: (f.label || f.name) + ' is required but empty' });
            }
          });
        });
      });
      return issues;
    },

    /* What would break if this object were deleted. */
    referencedBy(collection, id) {
      const S = window.ASoHaVSchema;
      const out = [];
      if (!S) return out;
      S.collections.forEach(col => {
        (this._lib[col.key] || []).forEach(obj => {
          col.fields.forEach(f => {
            const isRef = f.type === 'ref' && f.collection === collection && obj[f.name] === id;
            const isMulti = f.type === 'multiref' && f.collection === collection && Array.isArray(obj[f.name]) && obj[f.name].indexOf(id) >= 0;
            if (isRef || isMulti) out.push({ label: col.label, name: obj.Name || obj.Id, field: f.label || f.name });
          });
        });
      });
      return out;
    },

    async exportJSON() {
      return JSON.stringify({ exportedAt: now(), app: 'asohav-content-library', library: this._lib }, null, 2);
    },

    async importJSON(text) {
      const parsed = JSON.parse(text);
      const lib = parsed.library || parsed;
      if (!lib.virtues && !lib.moves) throw new Error('Not an ASoHaV library export.');
      this._lib = lib;
      this._logChange('import', 'library', { Id: 'library', Name: 'Whole library' }, null, { note: 'bulk import' });
      this._persist();
      return this._lib;
    },

    async reset() {
      this._lib = seedLibrary();
      this._logChange('reset', 'library', { Id: 'library', Name: 'Whole library' }, null, { note: 'reset to seed' });
      this._persist();
      return this._lib;
    },

    newId: uid
  };

  window.ASoHaVAdminStore = Store;
})();
