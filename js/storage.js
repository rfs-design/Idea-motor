// storage.js — IndexedDB wrapper for IdeaMotor projects

const DB_NAME    = 'ideamotor-db';
const DB_VERSION = 1;
const STORE      = 'projects';

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

/** Returns up to 5 rated projects of the given archetype (for feedback loop context) */
export async function getRatingsByArchetype(archetipo) {
  const all = await getAllProjects();
  return all
    .filter(p => p.archetipo === archetipo && p.rating)
    .slice(0, 5)
    .map(p => ({ nome_progetto: p.nome_progetto, archetipo: p.archetipo, rating: p.rating }));
}
