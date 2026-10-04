// The gate iPad's offline store (planning/02 D11, Q3), in IndexedDB, the browser's on-device database.
// It holds only: the minimal roster (name, type, programme, batch, record id: no photos, no phone numbers) and
// decisions made while offline, until they are recorded. It is wiped when the sign-in page opens on the device.

export type RosterRow = { id: string; full_name: string; kind: "alumnus" | "faculty" | "placement" | "student"; program: string | null; batch_year: number | null };
export type Roster = { at: string; guard: string; rows: RosterRow[] };
export type QueueItem = {
  client: string; person: string; name: string; approve: boolean; reason: string; purpose: string; at: string; guard: string;
  status: "pending" | "failed"; error?: string; attempts?: number;
};

const DB = "ma-offline";
export const QUEUE_EVENT = "ma-queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("kv");
      req.result.createObjectStore("queue", { keyPath: "client" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function run<T>(store: "kv" | "queue", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export const getRoster = () => run<Roster | undefined>("kv", "readonly", (s) => s.get("roster"));
export const putRoster = (r: Roster) => run("kv", "readwrite", (s) => s.put(r, "roster"));
export const allQueued = () => run<QueueItem[]>("queue", "readonly", (s) => s.getAll());
export async function putQueued(item: QueueItem) {
  await run("queue", "readwrite", (s) => s.put(item));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}
export async function dropQueued(client: string) {
  await run("queue", "readwrite", (s) => s.delete(client));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}
/**
 * Clear what this device saved (sign-in page; DPDP: no personal data left behind). The roster always goes.
 * Decisions not yet recorded are kept, so a sign-in that happens before they sync can't lose a gate entry;
 * they are recorded, and removed, once the device is signed in again.
 */
export async function wipeOffline(): Promise<void> {
  try {
    const waiting = (await allQueued()).length;
    if (waiting) { await run("kv", "readwrite", (s) => s.clear()); return; }
  } catch { /* fall through to a full delete */ }
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch { resolve(); }
  });
}

/** The same matching as the server's search: every typed word appears in the name; word starts first. */
export function searchRoster(rows: RosterRow[], q: string) {
  const term = q.toLowerCase().trim().replace(/\s+/g, " ");
  if (term.length < 3) return [];
  const words = term.split(" ");
  return rows
    .filter((r) => r.kind !== "student" && words.every((w) => r.full_name.toLowerCase().includes(w)))
    .sort((a, b) => Number((" " + b.full_name.toLowerCase()).includes(" " + term)) - Number((" " + a.full_name.toLowerCase()).includes(" " + term))
      || a.full_name.localeCompare(b.full_name))
    .slice(0, 25);
}

/** True when an error from a server call means "no network", not "the server said no". */
export function isNetworkError(e: unknown) {
  return !navigator.onLine || e instanceof TypeError || /fetch|network|load failed/i.test(String((e as Error)?.message ?? e));
}
