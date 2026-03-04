"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { FoodResultCard } from "./food-result-card";
import type { FoodItem } from "@/types/nutrition";

export function FoodSearchTab({ onFound }: { onFound: (food: FoodItem) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      setResults([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestSeqRef.current;
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/nutrition/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Search failed");
        }
        const data: FoodItem[] = await res.json();
        if (requestId === requestSeqRef.current) {
          setResults(data);
        }
      } catch (err) {
        const aborted =
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");
        if (aborted) return;

        const message = err instanceof Error ? err.message : "Search failed. Please try again.";
        toast.error(message);
        if (requestId === requestSeqRef.current) {
          setResults([]);
        }
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search foods... (e.g. chicken breast)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No results found for &quot;{query}&quot;
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

      {!loading && query.trim().length < 2 && query.trim().length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Type at least 2 characters to search
        </p>
      )}

      {!loading && query.trim().length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Search for a food item by name or brand
        </p>
      )}
    </div>
  );
}
