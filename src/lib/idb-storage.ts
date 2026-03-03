import type { StateStorage } from "zustand/middleware";

const isServer = typeof window === "undefined";

/**
 * Zustand StateStorage adapter backed by idb-keyval (IndexedDB).
 * Falls back to no-op on the server where indexedDB doesn't exist.
 */
export const idbStorage: StateStorage = {
  getItem: async (name) => {
    if (isServer) return null;
    const { get } = await import("idb-keyval");
    const value = await get<string>(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    if (isServer) return;
    const { set } = await import("idb-keyval");
    await set(name, value);
  },
  removeItem: async (name) => {
    if (isServer) return;
    const { del } = await import("idb-keyval");
    await del(name);
  },
};
