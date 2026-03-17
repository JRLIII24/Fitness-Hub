"use client";

import { useState, useRef } from "react";
import { UtensilsCrossed, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FoodResultCard } from "./food-result-card";
import type { FoodItem } from "@/types/nutrition";

export function RestaurantSearchTab({
  onFound,
}: {
  onFound: (food: FoodItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  async function handleSearch() {
    const q = query.trim();
    if (q.length < 2) return;

    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/nutrition/restaurant-search?q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Search failed");
      }
      const data: FoodItem[] = await res.json();
      setResults(data);
    } catch (err) {
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (aborted) return;
      const message =
        err instanceof Error ? err.message : "Search failed.";
      toast.error(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <UtensilsCrossed className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="e.g. Chipotle burrito bowl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoComplete="off"
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={loading || query.trim().length < 2}
          className="h-10 gap-1.5 px-3"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Search
        </Button>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Looking up nutrition data...
          </span>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No restaurant items found for &quot;{query}&quot;
        </p>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          {results.map((food) => (
            <button
              key={food.id}
              className="w-full text-left transition-opacity hover:opacity-80 active:opacity-60"
              onClick={() => onFound(food)}
            >
              <FoodResultCard food={food} />
            </button>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Search major restaurant chains by menu item name
        </p>
      )}
    </div>
  );
}
