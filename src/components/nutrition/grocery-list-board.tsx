"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Loader2, RefreshCw, Trash2, Plus, Check, ChevronDown, ChevronRight, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useGroceryStore } from "@/stores/grocery-store";

// ── component ────────────────────────────────────────────────────────────────

export function GroceryListBoard() {
  const {
    currentList, isGenerating, error,
    setList, toggleItem, removeItem, addItem, clearList, setGenerating, setError,
  } = useGroceryStore();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [addingCategory, setAddingCategory] = useState<number | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  // Hydrate store from IDB
  useEffect(() => {
    useGroceryStore.persist.rehydrate();
  }, []);

  const generateList = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/nutrition/grocery-list", { method: "POST" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to generate grocery list");
      }
      const data = await res.json();
      setList(data);
      toast.success("Grocery list generated!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate list";
      setError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }, [setList, setGenerating, setError]);

  const toggleCategory = useCallback((idx: number) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleAddItem = useCallback((categoryIdx: number) => {
    if (!newItemName.trim()) return;
    addItem(categoryIdx, newItemName.trim(), "1", "");
    setNewItemName("");
    setAddingCategory(null);
  }, [newItemName, addItem]);

  const startAdding = useCallback((categoryIdx: number) => {
    setAddingCategory(categoryIdx);
    setNewItemName("");
    setTimeout(() => addInputRef.current?.focus(), 50);
  }, []);

  // Sync changes to backend
  const syncToBackend = useCallback(async () => {
    if (!currentList) return;
    try {
      await fetch(`/api/nutrition/grocery-list/${currentList.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: currentList.categories }),
      });
    } catch {
      // Silent background sync
    }
  }, [currentList]);

  // Debounced sync on list changes
  useEffect(() => {
    if (!currentList) return;
    const timer = setTimeout(syncToBackend, 1500);
    return () => clearTimeout(timer);
  }, [currentList, syncToBackend]);

  // ── Empty state ──────────────────────────────────────────────────────────

  if (!currentList) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <ShoppingCart className="size-8 text-primary" />
        </div>
        <h2 className="mb-2 text-[15px] font-black text-foreground">No Grocery List Yet</h2>
        <p className="mb-6 max-w-[260px] text-[13px] text-muted-foreground">
          Generate a smart grocery list based on your recent food logs and nutrition goals.
        </p>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button className="gap-2" onClick={generateList} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShoppingCart className="size-4" />
            )}
            {isGenerating ? "Generating..." : "Generate My List"}
          </Button>
        </motion.div>
        {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────

  const totalItems = currentList.categories.reduce((s, c) => s + c.items.length, 0);
  const checkedItems = currentList.categories.reduce(
    (s, c) => s + c.items.filter((i) => i.checked).length,
    0
  );

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Progress</p>
          <p className="tabular-nums text-[13px] font-bold text-foreground">
            {checkedItems}/{totalItems}
          </p>
        </div>
        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: totalItems > 0 ? `${(checkedItems / totalItems) * 100}%` : "0%" }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {currentList.summary && (
          <p className="mt-2 text-[12px] text-muted-foreground">{currentList.summary}</p>
        )}
      </div>

      {/* Category sections */}
      {currentList.categories.map((cat, catIdx) => {
        const isCollapsed = collapsedCategories.has(catIdx);
        const catChecked = cat.items.filter((i) => i.checked).length;

        return (
          <div key={catIdx} className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(catIdx)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
              style={{ minHeight: 44 }}
            >
              {isCollapsed ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="text-[13px] font-bold text-foreground flex-1">{cat.category}</span>
              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                {catChecked}/{cat.items.length}
              </span>
            </button>

            {/* Items */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/40 px-2 py-1">
                    {cat.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex items-center gap-2 px-2 py-1.5"
                        style={{ minHeight: 44 }}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleItem(catIdx, itemIdx)}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            item.checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card/40"
                          }`}
                          style={{ minHeight: 44, minWidth: 44, padding: "10px" }}
                          aria-pressed={item.checked}
                          aria-label={item.checked ? "Uncheck item" : "Check item"}
                        >
                          {item.checked && <Check className="size-3" />}
                        </button>

                        {/* Name + qty */}
                        <div className={`flex-1 min-w-0 ${item.checked ? "line-through opacity-50" : ""}`}>
                          <span className="text-[13px] text-foreground">{item.name}</span>
                          {(item.quantity || item.unit) && (
                            <span className="ml-1.5 text-[11px] text-muted-foreground">
                              {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                            </span>
                          )}
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeItem(catIdx, itemIdx)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors"
                          style={{ minHeight: 44, minWidth: 44, padding: "8px" }}
                          aria-label="Remove item"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add item inline */}
                    {addingCategory === catIdx ? (
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <Input
                          ref={addInputRef}
                          placeholder="Item name"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddItem(catIdx);
                            if (e.key === "Escape") setAddingCategory(null);
                          }}
                          className="h-8 flex-1 text-[13px]"
                        />
                        <Button size="sm" className="min-h-[44px] gap-1" onClick={() => handleAddItem(catIdx)}>
                          <Plus className="size-3" />
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-[44px]"
                          onClick={() => setAddingCategory(null)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startAdding(catIdx)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                        style={{ minHeight: 44 }}
                      >
                        <Plus className="size-3.5" />
                        Add item
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Action bar */}
      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <RefreshCw className="size-4" />
                Regenerate
              </Button>
            </motion.div>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerate Grocery List?</AlertDialogTitle>
              <AlertDialogDescription>
                This will replace your current list with a new one based on your latest food logs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { clearList(); generateList(); }}>
                Regenerate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button variant="outline" size="icon" className="shrink-0">
                <Trash2 className="size-4" />
              </Button>
            </motion.div>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Grocery List?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all items from your list.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={clearList}>Clear</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
