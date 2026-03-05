import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/lib/idb-storage";
import type { GroceryCategory, GroceryListResult } from "@/lib/grocery/types";

interface GroceryState {
  currentList: GroceryListResult | null;
  isGenerating: boolean;
  error: string | null;
  _isHydrated: boolean;

  // Actions
  setList: (list: GroceryListResult | null) => void;
  toggleItem: (categoryIdx: number, itemIdx: number) => void;
  removeItem: (categoryIdx: number, itemIdx: number) => void;
  addItem: (categoryIdx: number, name: string, quantity: string, unit: string) => void;
  clearList: () => void;
  setGenerating: (v: boolean) => void;
  setError: (err: string | null) => void;
}

export const useGroceryStore = create<GroceryState>()(
  persist(
    (set, get) => ({
      currentList: null,
      isGenerating: false,
      error: null,
      _isHydrated: false,

      setList: (list) => set({ currentList: list, error: null }),

      toggleItem: (categoryIdx, itemIdx) => {
        const list = get().currentList;
        if (!list) return;
        const categories = list.categories.map((cat, ci) => {
          if (ci !== categoryIdx) return cat;
          return {
            ...cat,
            items: cat.items.map((item, ii) =>
              ii === itemIdx ? { ...item, checked: !item.checked } : item
            ),
          };
        });
        set({ currentList: { ...list, categories } });
      },

      removeItem: (categoryIdx, itemIdx) => {
        const list = get().currentList;
        if (!list) return;
        const categories = list.categories.map((cat, ci) => {
          if (ci !== categoryIdx) return cat;
          return { ...cat, items: cat.items.filter((_, ii) => ii !== itemIdx) };
        }).filter((cat) => cat.items.length > 0);
        set({ currentList: { ...list, categories } });
      },

      addItem: (categoryIdx, name, quantity, unit) => {
        const list = get().currentList;
        if (!list) return;
        const categories = list.categories.map((cat, ci) => {
          if (ci !== categoryIdx) return cat;
          return {
            ...cat,
            items: [...cat.items, { name, quantity, unit, checked: false }],
          };
        });
        set({ currentList: { ...list, categories } });
      },

      clearList: () => set({ currentList: null, error: null }),

      setGenerating: (v) => set({ isGenerating: v }),

      setError: (err) => set({ error: err }),
    }),
    {
      name: "fit-hub-grocery",
      storage: createJSONStorage(() => idbStorage),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) state._isHydrated = true;
      },
    }
  )
);
