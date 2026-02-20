"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Barcode,
  Search,
  Coffee,
  Sun,
  Moon,
  Cookie,
  ArrowLeft,
  X,
  Check,
  Loader2,
  Camera,
  CameraOff,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface FoodItem {
  id: string;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  serving_size_g?: number | null;
  serving_description?: string | null;
  calories_per_serving: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  source?: string | null;
}

const mealOptions: { value: MealType; label: string; icon: React.ElementType }[] = [
  { value: "breakfast", label: "Breakfast", icon: Coffee },
  { value: "lunch", label: "Lunch", icon: Sun },
  { value: "dinner", label: "Dinner", icon: Moon },
  { value: "snack", label: "Snack", icon: Cookie },
];

const servingOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

function FoodCard({ food }: { food: FoodItem }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground leading-snug">{food.name}</p>
          {food.brand && (
            <p className="text-xs text-muted-foreground">{food.brand}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {food.serving_description ?? (food.serving_size_g ? `${food.serving_size_g}g` : "1 serving")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-foreground">{Math.round(food.calories_per_serving)}</p>
          <p className="text-xs text-muted-foreground">kcal</p>
        </div>
      </div>
      {(food.protein_g != null ||
        food.carbs_g != null ||
        food.fat_g != null ||
        food.fiber_g != null ||
        food.sugar_g != null ||
        food.sodium_mg != null) && (
        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
          {food.protein_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.protein}`}>P</span> {Math.round(food.protein_g)}g
            </span>
          )}
          {food.carbs_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.carbs}`}>C</span> {Math.round(food.carbs_g)}g
            </span>
          )}
          {food.fat_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.fat}`}>F</span> {Math.round(food.fat_g)}g
            </span>
          )}
          {food.fiber_g != null && (
            <span>
              <span className={`font-medium ${MACRO_COLORS.fiber}`}>Fi</span> {Math.round(food.fiber_g)}g
            </span>
          )}
          {food.sugar_g != null && (
            <span>
              <span className="font-medium text-rose-400">Su</span> {Math.round(food.sugar_g)}g
            </span>
          )}
          {food.sodium_mg != null && (
            <span>
              <span className="font-medium text-cyan-400">Na</span> {Math.round(food.sodium_mg)}mg
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function LogFoodForm({
  food,
  initialMeal,
  onSuccess,
  onCancel,
}: {
  food: FoodItem;
  initialMeal: MealType;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [servings, setServings] = useState(1);
  const [customServings, setCustomServings] = useState("");
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [loading, setLoading] = useState(false);
  const supabase = useSupabase();

  async function ensurePersistedFoodItemId() {
    if (!food.id.startsWith("off-")) return food.id;

    const payload = {
      barcode: food.barcode ?? null,
      name: food.name,
      brand: food.brand ?? null,
      serving_size_g: food.serving_size_g ?? null,
      serving_description: food.serving_description ?? null,
      calories_per_serving: food.calories_per_serving,
      protein_g: food.protein_g ?? null,
      carbs_g: food.carbs_g ?? null,
      fat_g: food.fat_g ?? null,
      fiber_g: food.fiber_g ?? null,
      sugar_g: food.sugar_g ?? null,
      sodium_mg: food.sodium_mg ?? null,
      source: food.source ?? "openfoodfacts",
    };

    if (payload.barcode) {
      const { data, error } = await supabase
        .from("food_items")
        .upsert(payload, { onConflict: "barcode" })
        .select("id")
        .single();
      if (error || !data?.id) throw error ?? new Error("Could not persist food item");
      return data.id;
    }

    const { data, error } = await supabase
      .from("food_items")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data?.id) throw error ?? new Error("Could not persist food item");
    return data.id;
  }

  const displayServings = customServings ? parseFloat(customServings) : servings;

  const calculatedCalories = Math.round(food.calories_per_serving * displayServings);
  const calculatedProtein = food.protein_g != null ? Math.round(food.protein_g * displayServings * 10) / 10 : null;
  const calculatedCarbs = food.carbs_g != null ? Math.round(food.carbs_g * displayServings * 10) / 10 : null;
  const calculatedFat = food.fat_g != null ? Math.round(food.fat_g * displayServings * 10) / 10 : null;

  async function handleLog() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be signed in to log food.");
        return;
      }

      const foodItemId = await ensurePersistedFoodItemId();

      const { error } = await supabase.from("food_log").insert({
        user_id: user.id,
        food_item_id: foodItemId,
        meal_type: meal,
        servings: displayServings,
        calories_consumed: calculatedCalories,
        protein_g: calculatedProtein,
        carbs_g: calculatedCarbs,
        fat_g: calculatedFat,
        logged_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success(`${food.name} logged to ${meal}!`);
      onSuccess();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to log food. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{food.name}</p>
          {food.brand && <p className="text-xs text-muted-foreground">{food.brand}</p>}
        </div>
        <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={onCancel}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Serving size selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Servings</Label>
        <div className="flex flex-wrap gap-2">
          {servingOptions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setServings(s);
                setCustomServings("");
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                servings === s && !customServings
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/50"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            placeholder="Custom"
            value={customServings}
            onChange={(e) => {
              setCustomServings(e.target.value);
              if (e.target.value) setServings(1);
            }}
            className="h-9 text-sm"
          />
          <span className="flex items-center text-sm text-muted-foreground px-2">servings</span>
        </div>
      </div>

      {/* Calories preview */}
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Calories</span>
          <span className="text-lg font-bold text-foreground">{calculatedCalories} kcal</span>
        </div>
        <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
          {calculatedProtein != null && (
            <span><span className={MACRO_COLORS.protein}>P</span> {calculatedProtein}g</span>
          )}
          {calculatedCarbs != null && (
            <span><span className={MACRO_COLORS.carbs}>C</span> {calculatedCarbs}g</span>
          )}
          {calculatedFat != null && (
            <span><span className={MACRO_COLORS.fat}>F</span> {calculatedFat}g</span>
          )}
        </div>
      </div>

      {/* Meal type */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Meal</Label>
        <Select value={meal} onValueChange={(v) => setMeal(v as MealType)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mealOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <opt.icon className="size-3.5" />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleLog} disabled={loading} className="w-full gap-2">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Log Food
      </Button>
    </div>
  );
}

function BarcodeScanner({
  onFound,
  onCreateCustomRequested,
}: {
  onFound: (food: FoodItem) => void;
  onCreateCustomRequested: () => void;
}) {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showNotFoundDialog, setShowNotFoundDialog] = useState(false);
  const scannerTargetRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quaggaRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectedHandlerRef = useRef<((result: any) => void) | null>(null);

  const lookupBarcode = useCallback(
    async (code: string) => {
      if (!code.trim()) return;
      setScanning(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/nutrition/barcode/${encodeURIComponent(code.trim())}`);
        if (res.status === 404) {
          setNotFound(true);
          setShowNotFoundDialog(true);
          return;
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Barcode lookup failed");
        }
        const food: FoodItem = await res.json();
        onFound(food);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to look up barcode. Check your connection.";
        toast.error(message);
      } finally {
        setScanning(false);
      }
    },
    [onFound]
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (cameraActive) return;

    try {
      const targetEl = scannerTargetRef.current;
      if (!targetEl) {
        setCameraError("Scanner view is not ready. Please try again.");
        return;
      }

      // Ensure scanner target has usable dimensions before Quagga init
      let hasSize = false;
      for (let i = 0; i < 10; i += 1) {
        const rect = targetEl.getBoundingClientRect();
        if (rect.width > 20 && rect.height > 20) {
          hasSize = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (!hasSize) {
        setCameraError("Scanner failed to initialize. Please reopen this screen and try again.");
        return;
      }

      const { default: Quagga } = await import("@ericblade/quagga2");
      quaggaRef.current = Quagga;

      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: targetEl,
            constraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          locator: {
            patchSize: "medium",
            halfSample: true,
          },
          numOfWorkers:
            typeof navigator !== "undefined" && navigator.hardwareConcurrency
              ? Math.max(1, Math.min(4, navigator.hardwareConcurrency - 1))
              : 2,
          frequency: 10,
          decoder: {
            readers: [
              "ean_reader",
              "ean_8_reader",
              "upc_reader",
              "upc_e_reader",
              "code_128_reader",
              "code_39_reader",
            ],
          },
          locate: true,
        },
        (err: Error | null) => {
          if (err) {
            console.error("Quagga init error:", err);
            setCameraError("Could not initialize barcode scanner. Try manual barcode entry.");
            return;
          }
          try {
            Quagga.start();
            setCameraActive(true);
          } catch (startErr) {
            console.error("Quagga start error:", startErr);
            setCameraError("Could not start camera scanner.");
            return;
          }

          let lastCode = "";
          let lastTime = 0;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const handler = (result: any) => {
            const code = result?.codeResult?.code;
            const now = Date.now();
            if (code && (code !== lastCode || now - lastTime > 3000)) {
              lastCode = code;
              lastTime = now;
              lookupBarcode(code);
            }
          };

          detectedHandlerRef.current = handler;
          Quagga.onDetected(handler);
        }
      );
    } catch (err) {
      console.error(err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access and try again.");
      } else {
        setCameraError("Could not access camera. Try using the barcode input below.");
      }
    }
  }, [lookupBarcode]);

  const stopCamera = useCallback(() => {
    if (quaggaRef.current) {
      try {
        if (detectedHandlerRef.current && quaggaRef.current.offDetected) {
          quaggaRef.current.offDetected(detectedHandlerRef.current);
        }
        quaggaRef.current.stop();
      } catch {}
      quaggaRef.current = null;
    }
    detectedHandlerRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      <Dialog open={showNotFoundDialog} onOpenChange={setShowNotFoundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Barcode Not Found</DialogTitle>
            <DialogDescription>
              This product was not found. You can create a custom food with your own macros.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNotFoundDialog(false)}
            >
              Not Now
            </Button>
            <Button
              onClick={() => {
                setShowNotFoundDialog(false);
                onCreateCustomRequested();
              }}
            >
              Create Custom Food
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera viewport */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-black aspect-[4/3] w-full">
        <div
          ref={scannerTargetRef}
          className={`h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover [&>canvas]:h-full [&>canvas]:w-full ${
            cameraActive ? "opacity-100" : "opacity-0"
          }`}
        />
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/20">
            {cameraError ? (
              <>
                <CameraOff className="size-10 text-muted-foreground" />
                <p className="max-w-[240px] text-center text-sm text-muted-foreground">
                  {cameraError}
                </p>
              </>
            ) : (
              <>
                <Camera className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Tap to activate camera</p>
              </>
            )}
          </div>
        )}
        {/* Scanning guide overlay */}
        {cameraActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-32 w-64">
              {/* Corner brackets */}
              <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-primary" />
              <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-primary" />
              <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-primary" />
              <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-primary" />
              {/* Scan line animation */}
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-primary/60 animate-pulse" />
            </div>
          </div>
        )}
        {scanning && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              Looking up product...
            </Badge>
          </div>
        )}
      </div>

      {/* Camera toggle */}
      <Button
        variant={cameraActive ? "outline" : "default"}
        className="w-full gap-2"
        onClick={cameraActive ? stopCamera : startCamera}
      >
        {cameraActive ? (
          <>
            <CameraOff className="size-4" />
            Stop Camera
          </>
        ) : (
          <>
            <Camera className="size-4" />
            Start Camera
          </>
        )}
      </Button>

      {/* Manual barcode entry */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">
            or enter barcode manually
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="e.g. 0012000001628"
          value={barcodeInput}
          onChange={(e) => {
            setBarcodeInput(e.target.value);
            setNotFound(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") lookupBarcode(barcodeInput);
          }}
          className="flex-1"
        />
        <Button
          onClick={() => lookupBarcode(barcodeInput)}
          disabled={scanning || !barcodeInput.trim()}
          className="gap-1.5"
        >
          {scanning ? <Loader2 className="size-4 animate-spin" /> : <Barcode className="size-4" />}
          Look Up
        </Button>
      </div>

      {notFound && (
        <p className="text-center text-sm text-destructive">
          Product not found. Try the Search tab to find by name.
        </p>
      )}
    </div>
  );
}

function FoodSearch({ onFound }: { onFound: (food: FoodItem) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Search failed");
        }
        const data: FoodItem[] = await res.json();
        setResults(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed. Please try again.";
        toast.error(message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
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
              <FoodCard food={food} />
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

function CustomFoodCreator({
  onCreated,
  initialName,
  openSignal,
}: {
  onCreated: (food: FoodItem) => void;
  initialName?: string;
  openSignal?: number;
}) {
  const supabase = useSupabase();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [brand, setBrand] = useState("");
  const [servingAmount, setServingAmount] = useState("1");
  const [servingUnit, setServingUnit] = useState<"g" | "ml" | "oz" | "cup">("g");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [sodiumMg, setSodiumMg] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!name && initialName) setName(initialName);
  }, [initialName, open, name]);

  useEffect(() => {
    if (typeof openSignal === "number") {
      setOpen(true);
    }
  }, [openSignal]);

  function parseNumber(value: string): number | null {
    if (!value.trim()) return null;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }

  function convertToGrams(amount: number, unit: "g" | "ml" | "oz" | "cup"): number {
    if (unit === "g") return amount;
    if (unit === "ml") return amount; // Approximation: 1 ml ~ 1 g
    if (unit === "oz") return amount * 28.3495;
    return amount * 240; // Approximation: 1 cup ~ 240 ml ~ 240 g
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Food name is required.");
      return;
    }

    const parsedCalories = parseNumber(calories);
    if (parsedCalories === null || parsedCalories < 0) {
      toast.error("Please enter valid calories.");
      return;
    }

    const parsedProtein = parseNumber(protein);
    const parsedCarbs = parseNumber(carbs);
    const parsedFat = parseNumber(fat);
    const parsedFiber = parseNumber(fiber);
    const parsedSodium = parseNumber(sodiumMg);
    const parsedServingAmount = parseNumber(servingAmount);

    const values = [parsedProtein, parsedCarbs, parsedFat, parsedFiber, parsedSodium];
    if (values.some((v) => v !== null && v < 0)) {
      toast.error("Macros and sodium cannot be negative.");
      return;
    }
    if (parsedServingAmount === null || parsedServingAmount <= 0) {
      toast.error("Serving amount must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be signed in to create custom food.");
        return;
      }

      const servingSizeG = Math.round(
        convertToGrams(parsedServingAmount, servingUnit) * 100
      ) / 100;
      const servingDescription = `${parsedServingAmount} ${servingUnit}`;

      const payload = {
        name: trimmedName,
        brand: brand.trim() || null,
        serving_description: servingDescription,
        serving_size_g: servingSizeG,
        calories_per_serving: Math.round(parsedCalories * 100) / 100,
        protein_g: parsedProtein,
        carbs_g: parsedCarbs,
        fat_g: parsedFat,
        fiber_g: parsedFiber,
        sodium_mg: parsedSodium,
        source: "manual",
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from("food_items")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) throw error ?? new Error("Failed to create custom food");

      toast.success("Custom food created.");
      onCreated(data as FoodItem);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create custom food.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        Create Custom Food
      </Button>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Create Custom Food
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Food name (required)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Brand (optional)"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0.1}
            step={0.1}
            placeholder="Serving amount"
            value={servingAmount}
            onChange={(e) => setServingAmount(e.target.value)}
          />
          <Select
            value={servingUnit}
            onValueChange={(value) =>
              setServingUnit(value as "g" | "ml" | "oz" | "cup")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="g">Grams (g)</SelectItem>
              <SelectItem value="ml">Milliliters (ml)</SelectItem>
              <SelectItem value="oz">Ounces (oz)</SelectItem>
              <SelectItem value="cup">Cups</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Calories*"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Protein (g)"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Carbs (g)"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Fat (g)"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            placeholder="Fiber (g)"
            value={fiber}
            onChange={(e) => setFiber(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            placeholder="Sodium (mg)"
            value={sodiumMg}
            onChange={(e) => setSodiumMg(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Use"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentFoods({ onFound }: { onFound: (food: FoodItem) => void }) {
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabase();

  useEffect(() => {
    async function loadRecentFoods() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setRecentFoods([]);
          return;
        }

        const { data } = await supabase
          .from("food_log")
          .select(
            "logged_at, food_items(id, name, brand, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, serving_description, serving_size_g, barcode, source)"
          )
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(40);

        const typed = (data ?? []) as Array<{
          logged_at: string;
          food_items: FoodItem | FoodItem[] | null;
        }>;

        const seen = new Set<string>();
        const deduped: FoodItem[] = [];

        for (const row of typed) {
          const food = Array.isArray(row.food_items)
            ? row.food_items[0] ?? null
            : row.food_items;
          if (!food) continue;
          if (seen.has(food.id)) continue;
          seen.add(food.id);
          deduped.push(food);
          if (deduped.length >= 8) break;
        }

        setRecentFoods(deduped);
      } finally {
        setLoading(false);
      }
    }

    loadRecentFoods();
  }, [supabase]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Recently Logged
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading recent foods…</p>
        </CardContent>
      </Card>
    );
  }

  if (recentFoods.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recently Logged
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentFoods.map((food) => (
          <button
            key={food.id}
            className="w-full text-left transition-opacity hover:opacity-80 active:opacity-60"
            onClick={() => onFound(food)}
          >
            <FoodCard food={food} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export default function NutritionScanPage() {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawMeal = searchParams.get("meal");
  const quickFoodId = searchParams.get("quick_food_id");
  const validMeals: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
  const initialMeal: MealType = validMeals.includes(rawMeal as MealType)
    ? (rawMeal as MealType)
    : "snack";

  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [activeTab, setActiveTab] = useState<string>("scan");
  const [customCreatorOpenSignal, setCustomCreatorOpenSignal] = useState(0);

  useEffect(() => {
    if (!quickFoodId) return;
    if (selectedFood?.id === quickFoodId) return;

    async function loadQuickFood() {
      const { data, error } = await supabase
        .from("food_items")
        .select("*")
        .eq("id", quickFoodId)
        .maybeSingle();

      if (error || !data) return;
      setSelectedFood(data as FoodItem);
    }

    loadQuickFood();
  }, [quickFoodId, selectedFood?.id, supabase]);

  function handleFoodFound(food: FoodItem) {
    setSelectedFood(food);
  }

  function handleLogSuccess() {
    router.push("/nutrition");
  }

  function handleCancelLog() {
    setSelectedFood(null);
  }

  function handleCreateCustomFromBarcodeNotFound() {
    setActiveTab("search");
    setCustomCreatorOpenSignal((prev) => prev + 1);
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Link href="/nutrition">
          <Button size="icon" variant="ghost" className="size-9">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-foreground">Add Food</h1>
      </div>

      {/* Selected food + log form */}
      {selectedFood && (
        <div className="mb-4">
          <LogFoodForm
            food={selectedFood}
            initialMeal={initialMeal}
            onSuccess={handleLogSuccess}
            onCancel={handleCancelLog}
          />
        </div>
      )}

      {/* Quick add from history */}
      {!selectedFood && (
        <div className="mb-4">
          <RecentFoods onFound={handleFoodFound} />
        </div>
      )}

      {/* Tabs: Scan / Search */}
      {!selectedFood && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="scan" className="flex-1 gap-1.5">
              <Barcode className="size-4" />
              Scan Barcode
            </TabsTrigger>
            <TabsTrigger value="search" className="flex-1 gap-1.5">
              <Search className="size-4" />
              Search Food
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scan">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Point camera at barcode or enter it manually
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <BarcodeScanner
                  onFound={handleFoodFound}
                  onCreateCustomRequested={handleCreateCustomFromBarcodeNotFound}
                />
                <CustomFoodCreator onCreated={handleFoodFound} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search">
            <Card className="mb-3">
              <CardContent className="pt-4 space-y-3">
                <FoodSearch onFound={handleFoodFound} />
                <CustomFoodCreator
                  onCreated={handleFoodFound}
                  openSignal={customCreatorOpenSignal}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Show tabs again if food is selected to allow changing tab */}
      {selectedFood && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">Search for another food</p>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="scan" className="flex-1 gap-1.5">
                <Barcode className="size-4" />
                Scan
              </TabsTrigger>
              <TabsTrigger value="search" className="flex-1 gap-1.5">
                <Search className="size-4" />
                Search
              </TabsTrigger>
            </TabsList>
            <TabsContent value="scan">
              <Card>
                <CardContent className="pt-4">
                  <BarcodeScanner
                    onFound={handleFoodFound}
                    onCreateCustomRequested={handleCreateCustomFromBarcodeNotFound}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="search">
              <Card>
                <CardContent className="pt-4">
                  <FoodSearch onFound={handleFoodFound} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
