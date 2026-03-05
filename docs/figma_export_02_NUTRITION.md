# Fit-Hub — 02_NUTRITION Component Source

---
## src/components/nutrition/barcode-scanner.tsx
```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Barcode, Loader2, Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FoodItem } from "@/types/nutrition";

export function BarcodeScanner({
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
  }, [lookupBarcode, cameraActive]);

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
```

---
## src/components/nutrition/custom-food-dialog.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FoodItem } from "@/types/nutrition";

export function CustomFoodDialog({
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
```

---
## src/components/nutrition/edit-food-dialog.tsx
```tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FoodLogEntry {
  id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  food_name?: string;
  food_items?: {
    name: string;
  } | null;
}

interface Props {
  open: boolean;
  entry: FoodLogEntry | null;
  onClose: () => void;
  onSave: (entryId: string, updates: { meal_type: string; servings: number }) => Promise<void>;
}

export function EditFoodDialog({ open, entry, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [mealType, setMealType] = useState<string>(entry?.meal_type ?? "breakfast");
  const [servings, setServings] = useState<string>(String(entry?.servings ?? 1));

  const displayName = entry?.food_name || entry?.food_items?.name || "Food";

  async function handleSave() {
    if (!entry) return;

    setSaving(true);
    try {
      const servingsNum = parseFloat(servings);
      if (servingsNum <= 0) {
        alert("Servings must be greater than 0");
        setSaving(false);
        return;
      }

      await onSave(entry.id, {
        meal_type: mealType,
        servings: servingsNum,
      });

      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Food Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">{displayName}</p>

          <div className="space-y-2">
            <Label htmlFor="meal-type">Meal Type</Label>
            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger id="meal-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="servings">Servings</Label>
            <Input
              id="servings"
              type="number"
              step="0.25"
              min="0.25"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="Servings"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---
## src/components/nutrition/food-log-card.tsx
```tsx
"use client";

import { useState } from "react";
import { Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { EditFoodDialog } from "./edit-food-dialog";

interface FoodLogEntry {
  id: string;
  food_item_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  calories_consumed: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string;
  // Food item details (either flattened or nested)
  food_name?: string;
  food_brand?: string;
  serving_description?: string;
  food_items?: {
    name: string;
    brand: string | null;
    serving_description: string | null;
    serving_size_g?: number | null;
    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
    source?: string | null;
  } | null;
}

interface Props {
  entry: FoodLogEntry;
  onDelete: (entryId: string) => Promise<void>;
  onEdit: (entryId: string, updates: { meal_type: string; servings: number }) => Promise<void>;
}

export function FoodLogCard({ entry, onDelete, onEdit }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this food entry?")) return;

    setDeleting(true);
    try {
      await onDelete(entry.id);
      toast.success("Food entry deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete entry");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSave = async (entryId: string, updates: { meal_type: string; servings: number }) => {
    try {
      await onEdit(entryId, updates);
      toast.success("Food entry updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update entry");
      throw err;
    }
  };

  const displayName = entry.food_name || entry.food_items?.name || "Unknown Food";
  const displayBrand = entry.food_brand || entry.food_items?.brand;
  const displayServing = entry.serving_description || entry.food_items?.serving_description || (entry.servings ? `${entry.servings}x serving` : "1 serving");
  const totalFiber = (entry.food_items?.fiber_g ?? 0) * (entry.servings ?? 1);
  const totalSugar = (entry.food_items?.sugar_g ?? 0) * (entry.servings ?? 1);
  const totalSodium = (entry.food_items?.sodium_mg ?? 0) * (entry.servings ?? 1);
  const sourceLabel = entry.food_items?.source;

  return (
    <>
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{displayName}</p>
          {displayBrand && (
            <p className="text-xs text-muted-foreground truncate">{displayBrand}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{displayServing}</p>
          {entry.food_items?.serving_size_g != null && (
            <p className="text-[11px] text-muted-foreground">
              ~{Math.round(entry.food_items.serving_size_g * (entry.servings ?? 1) * 10) / 10}g total
            </p>
          )}

          {(entry.protein_g != null || entry.carbs_g != null || entry.fat_g != null) && (
            <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
              {entry.protein_g != null && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.protein}`}>P</span> {Math.round(entry.protein_g)}g
                </span>
              )}
              {entry.carbs_g != null && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.carbs}`}>C</span> {Math.round(entry.carbs_g)}g
                </span>
              )}
              {entry.fat_g != null && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.fat}`}>F</span> {Math.round(entry.fat_g)}g
                </span>
              )}
            </div>
          )}
          {(totalFiber > 0 || totalSugar > 0 || totalSodium > 0) && (
            <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
              {totalFiber > 0 && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.fiber}`}>Fi</span> {Math.round(totalFiber)}g
                </span>
              )}
              {totalSugar > 0 && (
                <span>
                  <span className="font-medium text-rose-400">Su</span> {Math.round(totalSugar)}g
                </span>
              )}
              {totalSodium > 0 && (
                <span>
                  <span className="font-medium text-cyan-400">Na</span> {Math.round(totalSodium)}mg
                </span>
              )}
            </div>
          )}
          {sourceLabel && (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {sourceLabel}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <p className="font-bold text-foreground text-sm">{Math.round(entry.calories_consumed)}</p>
            <p className="text-xs text-muted-foreground">kcal</p>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              onClick={() => setEditDialogOpen(true)}
              aria-label="Edit entry"
            >
              <Pencil className="size-4 text-muted-foreground" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete entry"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4 text-destructive" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <EditFoodDialog
        open={editDialogOpen}
        entry={entry}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleEditSave}
      />
    </>
  );
}
```

---
## src/components/nutrition/food-log-form.tsx
```tsx
"use client";

import { useState } from "react";
import { X, Check, Loader2, Coffee, Sun, Moon, Cookie } from "lucide-react";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { useSupabase } from "@/hooks/use-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FoodItem, MealType } from "@/types/nutrition";

const mealOptions: { value: MealType; label: string; icon: React.ElementType }[] = [
  { value: "breakfast", label: "Breakfast", icon: Coffee },
  { value: "lunch", label: "Lunch", icon: Sun },
  { value: "dinner", label: "Dinner", icon: Moon },
  { value: "snack", label: "Snack", icon: Cookie },
];

const servingOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export function FoodLogForm({
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
        <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={onCancel} aria-label="Cancel" style={{ minHeight: 44, minWidth: 44 }}>
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
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
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
```

---
## src/components/nutrition/food-result-card.tsx
```tsx
"use client";

import { MACRO_COLORS } from "@/lib/constants";
import type { FoodItem } from "@/types/nutrition";

export function FoodResultCard({ food }: { food: FoodItem }) {
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
```

---
## src/components/nutrition/food-scan-review.tsx
```tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, X, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FoodScanResult, FoodEstimation } from "@/lib/food-scanner/types";

const PORTION_MULTIPLIERS = [0.5, 1, 1.5, 2] as const;

interface ReviewItem extends FoodEstimation {
  included: boolean;
  multiplier: number;
}

interface FoodScanReviewProps {
  result: FoodScanResult;
  onConfirm: (items: Array<{
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>) => void;
  onCancel: () => void;
}

export function FoodScanReview({ result, onConfirm, onCancel }: FoodScanReviewProps) {
  const [items, setItems] = useState<ReviewItem[]>(() =>
    result.items.map((item) => ({ ...item, included: true, multiplier: 1 }))
  );

  const toggleItem = useCallback((idx: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, included: !item.included } : item)));
  }, []);

  const setMultiplier = useCallback((idx: number, multiplier: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, multiplier } : item)));
  }, []);

  const selectedItems = useMemo(() => items.filter((i) => i.included), [items]);

  const totalCalories = useMemo(
    () => selectedItems.reduce((sum, i) => sum + Math.round(i.estimated_calories * i.multiplier), 0),
    [selectedItems]
  );

  const handleConfirm = useCallback(() => {
    const mapped = selectedItems.map((item) => ({
      food_name: item.food_name,
      calories: Math.round(item.estimated_calories * item.multiplier),
      protein_g: Math.round(item.estimated_protein_g * item.multiplier),
      carbs_g: Math.round(item.estimated_carbs_g * item.multiplier),
      fat_g: Math.round(item.estimated_fat_g * item.multiplier),
    }));
    onConfirm(mapped);
  }, [selectedItems, onConfirm]);

  const confidenceColor = (c: "high" | "medium" | "low") => {
    switch (c) {
      case "high":
        return "bg-emerald-400/15 text-emerald-400";
      case "medium":
        return "bg-amber-400/15 text-amber-400";
      case "low":
        return "bg-red-400/15 text-red-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-[15px] font-black text-foreground">Review Detected Items</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Adjust portions and uncheck items you don&apos;t want to log.
        </p>
      </div>

      {/* Overall notes */}
      {result.overall_notes && (
        <div className="rounded-xl border border-border/50 bg-card/40 p-3">
          <p className="text-[12px] text-muted-foreground">{result.overall_notes}</p>
        </div>
      )}

      {/* Item cards */}
      <div className="space-y-3">
        {items.map((item, idx) => {
          const scaledCal = Math.round(item.estimated_calories * item.multiplier);
          const scaledP = Math.round(item.estimated_protein_g * item.multiplier);
          const scaledC = Math.round(item.estimated_carbs_g * item.multiplier);
          const scaledF = Math.round(item.estimated_fat_g * item.multiplier);
          const isHighCal = scaledCal > 3000;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-xl border border-border/50 p-4 space-y-3 transition-opacity ${
                item.included ? "bg-card/40" : "bg-card/20 opacity-50"
              }`}
            >
              {/* Top row: checkbox + name + confidence */}
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleItem(idx)}
                  className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                    item.included
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/40 text-transparent"
                  }`}
                  style={{ minHeight: 44, minWidth: 44, padding: "11px" }}
                >
                  <Check className="size-3" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground truncate">{item.food_name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.assumed_portion}</p>
                </div>
                <Badge className={`shrink-0 text-[10px] font-bold ${confidenceColor(item.confidence)}`}>
                  {item.confidence}
                </Badge>
              </div>

              {/* Portion multiplier */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  Portion
                </label>
                <div className="flex gap-1.5">
                  {PORTION_MULTIPLIERS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMultiplier(idx, m)}
                      className={`flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-colors ${
                        item.multiplier === m
                          ? "bg-primary text-primary-foreground"
                          : "bg-card/60 border border-border/50 text-muted-foreground"
                      }`}
                    >
                      {m}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Macro badges */}
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground">
                  {scaledCal} cal
                </span>
                <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-blue-400">
                  {scaledP}g P
                </span>
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-400">
                  {scaledC}g C
                </span>
                <span className="rounded-full bg-pink-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-pink-400">
                  {scaledF}g F
                </span>
              </div>

              {/* High calorie warning */}
              {isHighCal && (
                <div className="flex items-center gap-1.5 rounded-lg bg-yellow-400/10 px-2.5 py-2">
                  <AlertTriangle className="size-3 shrink-0 text-yellow-400" />
                  <p className="text-[11px] font-medium text-yellow-400">
                    Over 3,000 cal for a single item — double-check the portion
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Summary + actions */}
      <div className="rounded-xl border border-border/50 bg-card/40 p-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected
          </p>
          <p className="tabular-nums text-[20px] font-black leading-none text-foreground">
            {totalCalories} <span className="text-[11px] font-semibold text-muted-foreground">cal</span>
          </p>
        </div>

        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={onCancel}>
              <X className="size-4" />
              Cancel
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button
              className="w-full gap-2"
              onClick={handleConfirm}
              disabled={selectedItems.length === 0}
            >
              <Check className="size-4" />
              Log Selected
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
```

---
## src/components/nutrition/food-scanner.tsx
```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, CameraOff, Loader2, Upload, X, ScanLine } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { FoodScanResult } from "@/lib/food-scanner/types";
import { FoodScanReview } from "./food-scan-review";

// ── helpers ──────────────────────────────────────────────────────────────────

function compressImage(dataUrl: string, maxDim = 1024, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

type ScanState = "idle" | "cameraActive" | "capturedImage" | "analyzing" | "review";

// ── component ────────────────────────────────────────────────────────────────

export function FoodScanner() {
  const [state, setState] = useState<ScanState>("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<FoodScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("cameraActive");
    } catch (err) {
      console.error(err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access.");
      } else {
        setCameraError("Could not access camera. Try uploading a photo instead.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const compressed = await compressImage(dataUrl);
    setCapturedImage(compressed);
    stopCamera();
    setState("capturedImage");
  }, [stopCamera]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string);
      setCapturedImage(compressed);
      setState("capturedImage");
    };
    reader.readAsDataURL(file);
  }, []);

  const analyzeFood = useCallback(async () => {
    if (!capturedImage) return;
    setState("analyzing");
    try {
      const res = await fetch("/api/nutrition/food-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedImage, description: description.trim() || undefined }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to analyze food");
      }
      const data: FoodScanResult = await res.json();
      setResult(data);
      setState("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze food.");
      setState("capturedImage");
    }
  }, [capturedImage, description]);

  const reset = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setResult(null);
    setDescription("");
    setState("idle");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  const handleConfirm = useCallback(async (items: Array<{
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>) => {
    try {
      const res = await fetch("/api/nutrition/food-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, meal_type: "snack" }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to log food");
      }

      toast.success(`Logged ${items.length} item${items.length !== 1 ? "s" : ""}`);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log food");
    }
  }, [reset]);

  // Review mode
  if (state === "review" && result) {
    return (
      <FoodScanReview
        result={result}
        onConfirm={handleConfirm}
        onCancel={reset}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Camera viewport */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 aspect-[4/3] w-full">
        {capturedImage && state !== "cameraActive" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedImage} alt="Captured food" className="h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${state === "cameraActive" ? "opacity-100" : "opacity-0"}`}
            />
            {state !== "cameraActive" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/20">
                {cameraError ? (
                  <>
                    <CameraOff className="size-10 text-muted-foreground" />
                    <p className="max-w-[240px] text-center text-sm text-muted-foreground">{cameraError}</p>
                  </>
                ) : (
                  <>
                    <ScanLine className="size-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Snap a photo of your food</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {state === "analyzing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="secondary" className="gap-1.5 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Analyzing food...
            </Badge>
          </div>
        )}
      </div>

      {/* Description input */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
          What are you eating? (optional)
        </label>
        <Input
          placeholder="e.g. chicken rice bowl with avocado"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-[13px]"
        />
      </div>

      {/* Controls */}
      {state === "idle" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={startCamera}>
              <Camera className="size-4" />
              Open Camera
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              Upload Photo
            </Button>
          </motion.div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>
      )}

      {state === "cameraActive" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={() => { stopCamera(); setState("idle"); }}>
              <CameraOff className="size-4" />
              Cancel
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={capturePhoto}>
              <Camera className="size-4" />
              Capture
            </Button>
          </motion.div>
        </div>
      )}

      {state === "capturedImage" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={reset}>
              <X className="size-4" />
              Retake
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={analyzeFood}>
              <ScanLine className="size-4" />
              Analyze Food
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
```

---
## src/components/nutrition/food-search-tab.tsx
```tsx
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
```

---
## src/components/nutrition/grocery-list-board.tsx
```tsx
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
                        <Button size="sm" className="h-8 gap-1" onClick={() => handleAddItem(catIdx)}>
                          <Plus className="size-3" />
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
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
```

---
## src/components/nutrition/meal-template-sheet.tsx
```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SavedMealsList } from "@/components/nutrition/saved-meals-list";
import type { FoodItem, MealTemplate, MealTemplateItem } from "@/types/nutrition";

// Accept the shape used by the nutrition page (with nested food_items)
export interface NutritionPageEntry {
  id: string;
  food_item_id: string;
  meal_type: string;
  servings: number;
  calories_consumed: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  food_name?: string;
  food_brand?: string;
  serving_description?: string;
  food_items?: FoodItem | null;
}

export function MealTemplateSheet({
  open,
  onOpenChange,
  currentEntries,
  onLoadTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEntries: NutritionPageEntry[];
  onLoadTemplate: (items: MealTemplateItem[]) => void;
}) {
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition/meal-templates");
      if (res.ok) {
        const json = (await res.json()) as { data: MealTemplate[] };
        setTemplates(json.data);
      }
    } catch {
      toast.error("Failed to load saved meals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const handleSave = async () => {
    const name = templateName.trim();
    if (!name) {
      toast.error("Enter a name for the meal template");
      return;
    }
    if (currentEntries.length === 0) {
      toast.error("No food entries to save");
      return;
    }

    setSaving(true);
    try {
      const items: MealTemplateItem[] = currentEntries.map((entry) => {
        const fi = entry.food_items;
        return {
          food_item_id: entry.food_item_id ?? null,
          name: fi?.name ?? entry.food_name ?? "Unknown",
          brand: fi?.brand ?? entry.food_brand ?? null,
          servings: entry.servings,
          calories: fi?.calories_per_serving ?? entry.calories_consumed ?? 0,
          protein_g: fi?.protein_g ?? entry.protein_g ?? null,
          carbs_g: fi?.carbs_g ?? entry.carbs_g ?? null,
          fat_g: fi?.fat_g ?? entry.fat_g ?? null,
          serving_description: fi?.serving_description ?? entry.serving_description ?? null,
        };
      });

      const res = await fetch("/api/nutrition/meal-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items }),
      });

      if (res.ok) {
        toast.success("Meal template saved!");
        setTemplateName("");
        await fetchTemplates();
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(err?.error ?? "Failed to save template");
      }
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/nutrition/meal-templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success("Template deleted");
      } else {
        toast.error("Failed to delete template");
      }
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const handleUse = (template: MealTemplate) => {
    onLoadTemplate(template.items);
    onOpenChange(false);
    toast.success(`Loaded "${template.name}" into your log`);
  };

  const previewCalories = currentEntries.reduce((sum, e) => {
    const cal = e.food_items?.calories_per_serving ?? e.calories_consumed ?? 0;
    return sum + cal * e.servings;
  }, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-[15px] font-bold">Saved Meals</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="load" className="mt-2 px-4 pb-4">
          <TabsList className="w-full">
            <TabsTrigger value="load" className="flex-1">
              Load
            </TabsTrigger>
            <TabsTrigger value="save" className="flex-1">
              Save Current
            </TabsTrigger>
          </TabsList>

          <TabsContent value="load" className="mt-3">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SavedMealsList
                templates={templates}
                onUse={handleUse}
                onDelete={handleDelete}
              />
            )}
          </TabsContent>

          <TabsContent value="save" className="mt-3 space-y-4">
            {currentEntries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] font-semibold">Nothing to save</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Log some food first, then save it as a template.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Template Name
                  </label>
                  <Input
                    placeholder="e.g. Monday Breakfast"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="h-10 rounded-xl text-sm"
                  />
                </div>

                <div className="rounded-xl border border-border/50 bg-card/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Preview ({currentEntries.length} item
                    {currentEntries.length !== 1 ? "s" : ""} &middot;{" "}
                    {Math.round(previewCalories)} kcal)
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {currentEntries.map((entry) => {
                      const name =
                        entry.food_items?.name ??
                        entry.food_name ??
                        "Unknown";
                      const cal =
                        (entry.food_items?.calories_per_serving ??
                          entry.calories_consumed ??
                          0) * entry.servings;
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between text-[12px]"
                        >
                          <span className="min-w-0 truncate text-foreground">
                            {name}
                            {entry.servings !== 1 && (
                              <span className="ml-1 text-muted-foreground">
                                x{entry.servings}
                              </span>
                            )}
                          </span>
                          <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                            {Math.round(cal)} kcal
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving || !templateName.trim()}
                  className="w-full gap-2"
                  size="sm"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save Template"}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
```

---
## src/components/nutrition/menu-recommendation-sheet.tsx
```tsx
"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Utensils, Lightbulb } from "lucide-react";
import type { MenuScanResult, MenuRecommendation } from "@/lib/menu-scanner/types";

interface MenuRecommendationSheetProps {
  results: MenuScanResult | null;
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  onClose: () => void;
  onLog: (item: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void;
  open: boolean;
}

export function MenuRecommendationSheet({ results, remaining, onClose, onLog, open }: MenuRecommendationSheetProps) {
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open && results && (
        <SheetContent results={results} remaining={remaining} onClose={onClose} onLog={onLog} />
      )}
    </AnimatePresence>,
    portalTarget
  );
}

function SheetContent({
  results,
  remaining,
  onClose,
  onLog,
}: {
  results: MenuScanResult;
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  onClose: () => void;
  onLog: (item: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void;
}) {
  const macroPills = [
    { label: "Cal", value: remaining.calories, color: "bg-foreground/10 text-foreground" },
    { label: "P", value: `${remaining.protein_g}g`, color: "bg-blue-400/15 text-blue-400" },
    { label: "C", value: `${remaining.carbs_g}g`, color: "bg-amber-400/15 text-amber-400" },
    { label: "F", value: `${remaining.fat_g}g`, color: "bg-pink-400/15 text-pink-400" },
  ];

  function handleLog(rec: MenuRecommendation) {
    onLog({
      name: rec.name,
      calories: rec.estimated_calories,
      protein_g: rec.estimated_protein_g,
      carbs_g: rec.estimated_carbs_g,
      fat_g: rec.estimated_fat_g,
    });
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden glass-surface-modal glass-highlight rounded-t-3xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-0 pt-3">
          <div className="h-1 w-9 rounded-full bg-border/50" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <h2 className="text-[15px] font-black text-foreground">Menu Picks For You</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-opacity hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Remaining macros bar */}
        <div className="flex gap-2 px-5 pb-4">
          {macroPills.map((p) => (
            <div
              key={p.label}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${p.color}`}
            >
              <span className="opacity-60">{p.label}</span>
              <span className="tabular-nums">{p.value}</span>
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="space-y-3">
            {results.top_3_recommendations.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3"
              >
                {/* Name + reason */}
                <div>
                  <div className="flex items-start gap-2">
                    <Utensils className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <h3 className="text-[13px] font-bold text-foreground">{rec.name}</h3>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">{rec.reason}</p>
                </div>

                {/* Macro badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground">
                    {rec.estimated_calories} cal
                  </span>
                  <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-blue-400">
                    {rec.estimated_protein_g}g P
                  </span>
                  <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-400">
                    {rec.estimated_carbs_g}g C
                  </span>
                  <span className="rounded-full bg-pink-400/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-pink-400">
                    {rec.estimated_fat_g}g F
                  </span>
                </div>

                {/* Modification tip */}
                {rec.modification_tip && (
                  <div className="flex items-start gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-2">
                    <Lightbulb className="mt-0.5 size-3 shrink-0 text-amber-400" />
                    <p className="text-[11px] text-amber-400">{rec.modification_tip}</p>
                  </div>
                )}

                {/* Log button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleLog(rec)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12px] font-bold text-primary-foreground"
                >
                  Log This
                </motion.button>
              </motion.div>
            ))}
          </div>

          {/* Overall tip */}
          {results.overall_tip && (
            <div className="mt-4 rounded-xl border border-border/50 bg-card/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Overall Tip</p>
              <p className="text-[12px] text-muted-foreground">{results.overall_tip}</p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
```

---
## src/components/nutrition/menu-scanner.tsx
```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, CameraOff, Loader2, Upload, X, Utensils } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MenuScanResult } from "@/lib/menu-scanner/types";
import { MenuRecommendationSheet } from "./menu-recommendation-sheet";
import { createClient } from "@/lib/supabase/client";

// ── helpers ──────────────────────────────────────────────────────────────────

function compressImage(dataUrl: string, maxDim = 1024, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

type ScanState = "idle" | "cameraActive" | "capturedImage" | "analyzing" | "result";

// ── component ────────────────────────────────────────────────────────────────

export function MenuScanner() {
  const [state, setState] = useState<ScanState>("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<MenuScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  const [showSheet, setShowSheet] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch today's remaining macros
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().slice(0, 10);
      const { data: profile } = await supabase
        .from("profiles")
        .select("calorie_goal, protein_goal_g, carb_goal_g, fat_goal_g")
        .eq("id", user.id)
        .single();
      const { data: logs } = await supabase
        .from("food_log")
        .select("calories_consumed, protein_g, carbs_g, fat_g")
        .eq("user_id", user.id)
        .gte("logged_at", `${today}T00:00:00`)
        .lte("logged_at", `${today}T23:59:59`);

      const eaten = (logs ?? []).reduce(
        (acc, l) => ({
          calories: acc.calories + (l.calories_consumed ?? 0),
          protein_g: acc.protein_g + (l.protein_g ?? 0),
          carbs_g: acc.carbs_g + (l.carbs_g ?? 0),
          fat_g: acc.fat_g + (l.fat_g ?? 0),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      );

      setRemaining({
        calories: Math.max(0, (profile?.calorie_goal ?? 2000) - eaten.calories),
        protein_g: Math.max(0, (profile?.protein_goal_g ?? 150) - eaten.protein_g),
        carbs_g: Math.max(0, (profile?.carb_goal_g ?? 250) - eaten.carbs_g),
        fat_g: Math.max(0, (profile?.fat_goal_g ?? 65) - eaten.fat_g),
      });
    })();
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("cameraActive");
    } catch (err) {
      console.error(err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access.");
      } else {
        setCameraError("Could not access camera. Try uploading a photo instead.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const compressed = await compressImage(dataUrl);
    setCapturedImage(compressed);
    stopCamera();
    setState("capturedImage");
  }, [stopCamera]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string);
      setCapturedImage(compressed);
      setState("capturedImage");
    };
    reader.readAsDataURL(file);
  }, []);

  const analyzeMenu = useCallback(async () => {
    if (!capturedImage) return;
    setState("analyzing");
    try {
      const res = await fetch("/api/nutrition/menu-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedImage }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to analyze menu");
      }
      const data: MenuScanResult = await res.json();
      setResult(data);
      setShowSheet(true);
      setState("result");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze menu.");
      setState("capturedImage");
    }
  }, [capturedImage]);

  const handleLog = useCallback(async (item: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Create food_items entry for this menu item
      const { data: foodItem, error: fiErr } = await supabase
        .from("food_items")
        .insert({
          name: item.name,
          calories_per_serving: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          source: "menu-scan",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (fiErr || !foodItem) throw fiErr ?? new Error("Failed to create food item");

      // 2. Log into food_log referencing that food_item
      const { error: flErr } = await supabase.from("food_log").insert({
        user_id: user.id,
        food_item_id: foodItem.id,
        meal_type: "snack",
        servings: 1,
        calories_consumed: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        logged_at: new Date().toISOString(),
      });
      if (flErr) throw flErr;
      toast.success(`Logged ${item.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log food");
    }
  }, []);

  const reset = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setResult(null);
    setShowSheet(false);
    setState("idle");
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      {/* Camera viewport */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 aspect-[4/3] w-full">
        {capturedImage && state !== "cameraActive" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedImage} alt="Captured menu" className="h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${state === "cameraActive" ? "opacity-100" : "opacity-0"}`}
            />
            {state !== "cameraActive" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/20">
                {cameraError ? (
                  <>
                    <CameraOff className="size-10 text-muted-foreground" />
                    <p className="max-w-[240px] text-center text-sm text-muted-foreground">{cameraError}</p>
                  </>
                ) : (
                  <>
                    <Utensils className="size-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Snap a photo of the menu</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {state === "analyzing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="secondary" className="gap-1.5 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Analyzing menu...
            </Badge>
          </div>
        )}
      </div>

      {/* Controls */}
      {state === "idle" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={startCamera}>
              <Camera className="size-4" />
              Open Camera
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              Upload Photo
            </Button>
          </motion.div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>
      )}

      {state === "cameraActive" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={() => { stopCamera(); setState("idle"); }}>
              <CameraOff className="size-4" />
              Cancel
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={capturePhoto}>
              <Camera className="size-4" />
              Capture
            </Button>
          </motion.div>
        </div>
      )}

      {state === "capturedImage" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={reset}>
              <X className="size-4" />
              Retake
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={analyzeMenu}>
              <Utensils className="size-4" />
              Analyze Menu
            </Button>
          </motion.div>
        </div>
      )}

      {state === "result" && (
        <div className="flex gap-2">
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button variant="outline" className="w-full gap-2" onClick={reset}>
              <Camera className="size-4" />
              Scan Another
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button className="w-full gap-2" onClick={() => setShowSheet(true)}>
              <Utensils className="size-4" />
              View Results
            </Button>
          </motion.div>
        </div>
      )}

      {/* Overall tip */}
      {result && (
        <div className="rounded-xl border border-border/50 bg-card/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Tip</p>
          <p className="text-[13px] text-muted-foreground">{result.overall_tip}</p>
        </div>
      )}

      {/* Bottom sheet */}
      <MenuRecommendationSheet
        results={result}
        remaining={remaining}
        onClose={() => setShowSheet(false)}
        onLog={handleLog}
        open={showSheet}
      />
    </div>
  );
}
```

---
## src/components/nutrition/recent-foods.tsx
```tsx
"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FoodResultCard } from "./food-result-card";
import type { FoodItem } from "@/types/nutrition";

export function RecentFoods({ onFound }: { onFound: (food: FoodItem) => void }) {
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
          <p className="text-sm text-muted-foreground">Loading recent foods...</p>
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
            <FoodResultCard food={food} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
```

---
## src/components/nutrition/saved-meals-list.tsx
```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, UtensilsCrossed, Loader2 } from "lucide-react";
import type { MealTemplate } from "@/types/nutrition";

export function SavedMealsList({
  templates,
  onUse,
  onDelete,
}: {
  templates: MealTemplate[];
  onUse: (template: MealTemplate) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (!templates.length) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <UtensilsCrossed className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-[13px] font-semibold">No saved meals yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Save a meal from your daily log to reuse it quickly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {templates.map((t, idx) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.04 }}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3.5"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{t.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {t.items.length} item{t.items.length !== 1 ? "s" : ""} &middot;{" "}
              {Math.round(
                t.items.reduce((sum, i) => sum + i.calories * i.servings, 0)
              )}{" "}
              kcal
            </p>
          </div>
          <button
            onClick={() => onUse(t)}
            className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            Use
          </button>
          <button
            onClick={() => handleDelete(t.id)}
            disabled={deletingId === t.id}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-destructive"
          >
            {deletingId === t.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </motion.div>
      ))}
    </div>
  );
}
```

