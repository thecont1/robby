import type { TraceStep } from "@/lib/demoData";
import type { RobbyIr } from "@/lib/robbyCompiler";

export type CompileSnapshot = {
  id: string;
  specimenId: string;
  source: string;
  ir: RobbyIr;
  trace: readonly TraceStep[];
  compiledAt: string;
  irHash: string;
  origin: "baseline" | "editor";
};

const DATABASE_NAME = "robby-compile-history";
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const MAX_SNAPSHOTS_PER_SPECIMEN = 12;

function openHistoryDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.createObjectStore(SNAPSHOT_STORE, { keyPath: "id" });
      store.createIndex("specimenId", "specimenId", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export function sortCompileHistory(history: readonly CompileSnapshot[]) {
  return [...history].sort((left, right) => left.compiledAt.localeCompare(right.compiledAt));
}

export async function loadCompileHistory(specimenId: string) {
  const database = await openHistoryDatabase();
  return new Promise<CompileSnapshot[]>((resolve, reject) => {
    const transaction = database.transaction(SNAPSHOT_STORE, "readonly");
    const request = transaction.objectStore(SNAPSHOT_STORE).index("specimenId").getAll(specimenId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(sortCompileHistory(request.result as CompileSnapshot[]));
    transaction.oncomplete = () => database.close();
  });
}

export async function persistCompileSnapshot(snapshot: CompileSnapshot) {
  const database = await openHistoryDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
    const store = transaction.objectStore(SNAPSHOT_STORE);
    store.put(snapshot);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
  database.close();

  const history = await loadCompileHistory(snapshot.specimenId);
  const overflow = history.slice(0, Math.max(0, history.length - MAX_SNAPSHOTS_PER_SPECIMEN));
  if (!overflow.length) return history;

  const trimmingDatabase = await openHistoryDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = trimmingDatabase.transaction(SNAPSHOT_STORE, "readwrite");
    const store = transaction.objectStore(SNAPSHOT_STORE);
    overflow.forEach(item => store.delete(item.id));
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
  trimmingDatabase.close();
  return history.slice(-MAX_SNAPSHOTS_PER_SPECIMEN);
}
