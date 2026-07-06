// storage.js — IndexedDB wrapper for IdeaMotor projects

const DB_NAME        = 'ideamotor-db';
const DB_VERSION     = 2;
const STORE          = 'projects';
const STORE_SETTINGS = 'settings';

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('archetipo',  'archetipo',  { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS); // key-value store: API keys, prefs
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function saveProject(project) {
  const db = await openDB();
  const now = new Date().toISOString();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add({
      ...project,
      rating:     null,
      created_at: now,
      updated_at: now,
    });
    req.onsuccess = (e) => resolve(e.target.result); // returns new id
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function getProject(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function getAllProjects() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = (e) => resolve([...e.target.result].reverse()); // newest first
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function updateRating(id, rating) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const get   = store.get(id);

    get.onsuccess = (e) => {
      const project = e.target.result;
      if (!project) { reject(new Error('Progetto non trovato')); return; }
      project.rating     = rating;
      project.updated_at = new Date().toISOString();
      const put          = store.put(project);
      put.onsuccess = () => resolve(project);
      put.onerror   = (e) => reject(e.target.error);
    };
    get.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteProject(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Import an array of projects (from a backup file) into the store.
 * Ids are dropped and reassigned by autoIncrement to avoid collisions with existing
 * rows; items are added oldest-first so the chronological order is preserved.
 * Returns the number of projects imported.
 */
export async function importProjects(projects) {
  const list = Array.isArray(projects) ? projects : [];
  if (list.length === 0) return 0;

  // Oldest first → lowest id, so getAllProjects() (newest-first) stays correct.
  const ordered = list.slice().sort(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let count = 0;
    ordered.forEach(p => {
      const { id, ...rest } = p; // drop the old id
      if (!rest.created_at) rest.created_at = new Date().toISOString();
      if (!rest.updated_at) rest.updated_at = rest.created_at;
      store.add(rest);
      count++;
    });
    tx.oncomplete = () => resolve(count);
    tx.onerror    = (e) => reject(e.target.error);
  });
}

/** Returns up to 5 rated projects of the given archetype (for feedback loop context) */
export async function getRatingsByArchetype(archetipo) {
  const all = await getAllProjects();
  return all
    .filter(p => p.archetipo === archetipo && p.rating)
    .slice(0, 5)
    .map(p => ({ nome_progetto: p.nome_progetto, archetipo: p.archetipo, rating: p.rating }));
}

// ── Settings store (key-value: API keys, prefs) ────────────────────────────
// IndexedDB persists more reliably than localStorage in iOS standalone PWAs.

export async function getSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_SETTINGS, 'readonly').objectStore(STORE_SETTINGS).get(key);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function setSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE_SETTINGS, 'readwrite').objectStore(STORE_SETTINGS);
    const req   = (value == null || value === '') ? store.delete(key) : store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}
