// Lưu lịch sử phân tích trên chính điện thoại (IndexedDB).
const DB = 'caulong-coach', STORE = 'sessions';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
}
export const save = rec => tx('readwrite', s => s.put(rec));
export const remove = id => tx('readwrite', s => s.delete(id));
export const get = id => tx('readonly', s => s.get(id));
export async function all() {
  const list = await tx('readonly', s => s.getAll());
  return (list || []).sort((a, b) => b.date - a.date);
}
