import type { GpsPoint } from "@/types/run";
import { openDB, type IDBPDatabase } from "idb";

interface RunTrackDB {
  tracks: {
    key: [string, number];
    value: { runId: string; index: number; points: GpsPoint[] };
    indexes: { "by-run": string };
  };
}

const DB_NAME = "RunTrackStore";
const DB_VERSION = 1;
const BATCH_SIZE = 50;

let dbPromise: Promise<IDBPDatabase<RunTrackDB>> | null = null;

function getDb(): Promise<IDBPDatabase<RunTrackDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB not available on server"));
  }
  if (!dbPromise) {
    dbPromise = openDB<RunTrackDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("tracks", {
          keyPath: ["runId", "index"],
        });
        store.createIndex("by-run", "runId");
      },
    });
  }
  return dbPromise;
}

type PendingRunTrack = {
  points: GpsPoint[];
  batchIndex: number;
};

const pendingByRun = new Map<string, PendingRunTrack>();

function getPending(runId: string): PendingRunTrack {
  const existing = pendingByRun.get(runId);
  if (existing) return existing;
  const created: PendingRunTrack = { points: [], batchIndex: 0 };
  pendingByRun.set(runId, created);
  return created;
}

export function resetTrackBuffer() {
  pendingByRun.clear();
}

export async function appendGpsPoint(runId: string, point: GpsPoint) {
  const pending = getPending(runId);
  pending.points.push(point);
  if (pending.points.length >= BATCH_SIZE) {
    await flushGpsPoints(runId);
  }
}

export async function flushGpsPoints(runId: string) {
  const pending = getPending(runId);
  if (pending.points.length === 0) return;
  try {
    const db = await getDb();
    await db.put("tracks", {
      runId,
      index: pending.batchIndex++,
      points: [...pending.points],
    });
    pending.points = [];
  } catch (e) {
    console.error("Failed to flush GPS points to IDB:", e);
  }
}

export async function getAllGpsPoints(runId: string): Promise<GpsPoint[]> {
  try {
    const db = await getDb();
    const batches = await db.getAllFromIndex("tracks", "by-run", runId);
    batches.sort((a, b) => a.index - b.index);
    const pending = getPending(runId);
    return batches.flatMap((b) => b.points).concat(pending.points);
  } catch {
    return [];
  }
}

export async function deleteRunTrack(runId: string) {
  try {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex("tracks", "by-run", runId);
    const tx = db.transaction("tracks", "readwrite");
    await Promise.all(keys.map((k) => tx.store.delete(k)));
    await tx.done;
    pendingByRun.delete(runId);
  } catch (e) {
    console.error("Failed to delete run track from IDB:", e);
  }
}
