// Storage. Inside the Claude app the page saves to the person's Claude account (db capability, private per person);
// as a stand-alone web app it saves on the device (IndexedDB), with an in-memory fallback when neither is available.
const Store = (() => {
  const NAME = 'drive-thru-macros';
  let backend = null; // 'cloud' | 'idb' | 'memory'
  let initP = null;
  let db = null, uid = null, idbP = null;
  const memory = { kv: new Map(), meals: new Map() };

  // ---------- IndexedDB ----------
  function openIdb() {
    if (idbP) return idbP;
    idbP = new Promise((resolve, reject) => {
      if (!('indexedDB' in self)) { reject(new Error('no-idb')); return; }
      let req;
      try { req = indexedDB.open(NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('meals')) d.createObjectStore('meals', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    });
    return idbP;
  }
  async function idbRun(storeName, mode, fn) {
    const d = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(storeName, mode);
      const req = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('aborted'));
    });
  }

  // ---------- Claude account (db capability) ----------
  const kvDoc = (key) => db.doc(`data/users/${uid}/${key}`);
  const mealsCol = () => db.doc(`data/users/${uid}/log`).collection('meals');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function fromCloud(key, body) {
    if (!body) return null;
    if ('v' in body) return body.v;
    // shapes written by the earlier version of the page
    if (key === 'prices' && body.items) return body.items;
    if (key === 'cart' && body.items && !Array.isArray(body.items)) return { items: Object.entries(body.items), sauces: body.sauces || {} };
    return body;
  }

  async function init() {
    if (initP) return initP;
    initP = (async () => {
      if (self.claude && typeof self.claude.use === 'function') {
        try {
          const [u, d] = await Promise.all([self.claude.use('user'), self.claude.use('db')]);
          const id = u && typeof u.id === 'function' ? await u.id() : null;
          if (d && id) { db = d; uid = id; backend = 'cloud'; return backend; }
        } catch (e) { /* fall through to device storage */ }
      }
      try { await openIdb(); backend = 'idb'; } catch (e) { backend = 'memory'; }
      return backend;
    })();
    return initP;
  }

  return {
    init,
    get backend() { return backend; },
    async get(key) {
      await init();
      if (backend === 'cloud') { const s = await kvDoc(key).get(); return s.exists ? fromCloud(key, s.data()) : null; }
      if (backend === 'idb') { const v = await idbRun('kv', 'readonly', (s) => s.get(key)); return v ?? null; }
      return memory.kv.get(key) ?? null;
    },
    async set(key, value) {
      await init();
      if (backend === 'cloud') return kvDoc(key).set({ v: clone(value), updatedAt: new Date().toISOString() });
      if (backend === 'idb') return idbRun('kv', 'readwrite', (s) => s.put(value, key));
      memory.kv.set(key, value);
    },
    async meals() {
      await init();
      if (backend === 'cloud') { const snap = await mealsCol().limit(1000).get(); return snap.docs.map((d) => ({ ...clone(d.data()), id: d.id })); }
      if (backend === 'idb') return (await idbRun('meals', 'readonly', (s) => s.getAll())) || [];
      return [...memory.meals.values()];
    },
    async putMeal(meal) {
      await init();
      if (backend === 'cloud') return mealsCol().doc(meal.id).set(clone(meal));
      if (backend === 'idb') return idbRun('meals', 'readwrite', (s) => s.put(meal));
      memory.meals.set(meal.id, meal);
    },
    async putMeals(list) {
      for (const m of list) await this.putMeal(m); // one write at a time
    },
    async deleteMeal(id) {
      await init();
      if (backend === 'cloud') return mealsCol().doc(id).delete();
      if (backend === 'idb') return idbRun('meals', 'readwrite', (s) => s.delete(id));
      memory.meals.delete(id);
    },
    async clearAll() {
      await init();
      if (backend === 'cloud') {
        const all = await this.meals();
        for (const m of all) await mealsCol().doc(m.id).delete();
        for (const k of ['cart', 'settings', 'prices', 'customDeals']) await kvDoc(k).delete();
        return;
      }
      if (backend === 'idb') { await idbRun('meals', 'readwrite', (s) => s.clear()); await idbRun('kv', 'readwrite', (s) => s.clear()); return; }
      memory.kv.clear(); memory.meals.clear();
    },
    async persist() {
      if (backend !== 'idb') return false;
      try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* not supported */ }
      return false;
    },
  };
})();
