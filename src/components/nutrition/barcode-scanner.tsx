"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Barcode, Loader2, Camera, CameraOff, Aperture, Check, X, Edit3, Plus } from "lucide-react";
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
import { FOOD_VISION_ENABLED } from "@/lib/features";
import type { FoodEstimation, FoodEstimationItem } from "@/lib/vision/types";

export function BarcodeScanner({
  onFound,
  onCreateCustomRequested,
}: {
  onFound: (food: FoodItem) => void;
  onCreateCustomRequested: () => void;
}) {
  const [mode, setMode] = useState<"barcode" | "photo">("barcode");
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

  // Photo mode state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photoCamera, setPhotoCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [estimationResult, setEstimationResult] = useState<FoodEstimation | null>(null);
  const [editingItems, setEditingItems] = useState<FoodEstimationItem[]>([]);

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

  // Photo mode camera
  const startPhotoCamera = useCallback(async () => {
    setCameraError(null);
    setCapturedImage(null);
    setEstimationResult(null);
    setEditingItems([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhotoCamera(true);
    } catch (err) {
      console.error(err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access and try again.");
      } else {
        setCameraError("Could not access camera.");
      }
    }
  }, []);

  const stopPhotoCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPhotoCamera(false);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopPhotoCamera();
  }, [stopPhotoCamera]);

  const analyzePhoto = useCallback(async () => {
    if (!capturedImage) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/nutrition/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedImage }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to analyze image");
      }
      const data: FoodEstimation = await res.json();
      setEstimationResult(data);
      setEditingItems(data.items.map((item) => ({ ...item })));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to analyze food photo.";
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }, [capturedImage]);

  const addAllItems = useCallback(() => {
    for (const item of editingItems) {
      const foodItem: FoodItem = {
        id: `vision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        barcode: null,
        name: item.name,
        brand: null,
        serving_size_g: item.estimated_grams,
        serving_description: `${item.estimated_grams}g (estimated)`,
        calories_per_serving: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        fiber_g: null,
        sugar_g: null,
        sodium_mg: null,
        source: "vision",
      };
      onFound(foodItem);
    }
    toast.success(`Added ${editingItems.length} item${editingItems.length !== 1 ? "s" : ""}`);
    setCapturedImage(null);
    setEstimationResult(null);
    setEditingItems([]);
  }, [editingItems, onFound]);

  const updateItem = useCallback((index: number, field: keyof FoodEstimationItem, value: string | number) => {
    setEditingItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setEditingItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Switch modes: stop whichever camera is active
  const switchMode = useCallback(
    (newMode: "barcode" | "photo") => {
      if (newMode === mode) return;
      if (mode === "barcode") stopCamera();
      if (mode === "photo") stopPhotoCamera();
      setCameraError(null);
      setCapturedImage(null);
      setEstimationResult(null);
      setEditingItems([]);
      setMode(newMode);
    },
    [mode, stopCamera, stopPhotoCamera]
  );

  useEffect(() => {
    return () => {
      stopCamera();
      stopPhotoCamera();
    };
  }, [stopCamera, stopPhotoCamera]);

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

      {/* Mode toggle (only if food vision is enabled) */}
      {FOOD_VISION_ENABLED && (
        <div className="flex rounded-lg border border-border p-1 gap-1">
          <button
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "barcode"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => switchMode("barcode")}
          >
            Scan Barcode
          </button>
          <button
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "photo"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => switchMode("photo")}
          >
            Snap Photo
          </button>
        </div>
      )}

      {/* ── Barcode Mode ── */}
      {mode === "barcode" && (
        <>
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
        </>
      )}

      {/* ── Photo Mode ── */}
      {mode === "photo" && (
        <>
          {/* Camera / captured image viewport */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-black aspect-[4/3] w-full">
            {capturedImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capturedImage} alt="Captured food" className="h-full w-full object-cover" />
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${photoCamera ? "opacity-100" : "opacity-0"}`}
                />
                {!photoCamera && (
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
                        <Aperture className="size-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Take a photo of your meal</p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
            {analyzing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Badge variant="secondary" className="gap-1.5 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing food...
                </Badge>
              </div>
            )}
          </div>

          {/* Photo controls */}
          {!capturedImage && !estimationResult && (
            <div className="flex gap-2">
              {photoCamera ? (
                <>
                  <Button variant="outline" className="flex-1 gap-2" onClick={stopPhotoCamera}>
                    <CameraOff className="size-4" />
                    Cancel
                  </Button>
                  <Button className="flex-1 gap-2" onClick={capturePhoto}>
                    <Aperture className="size-4" />
                    Capture
                  </Button>
                </>
              ) : (
                <Button className="w-full gap-2" onClick={startPhotoCamera}>
                  <Camera className="size-4" />
                  Open Camera
                </Button>
              )}
            </div>
          )}

          {capturedImage && !estimationResult && !analyzing && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  setCapturedImage(null);
                  startPhotoCamera();
                }}
              >
                <X className="size-4" />
                Retake
              </Button>
              <Button className="flex-1 gap-2" onClick={analyzePhoto}>
                <Edit3 className="size-4" />
                Analyze
              </Button>
            </div>
          )}

          {/* Estimation results */}
          {estimationResult && editingItems.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{estimationResult.meal_description}</p>

              <div className="space-y-2">
                {editingItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-border/50 bg-card/40 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(idx, "name", e.target.value)}
                          className="h-8 text-sm font-medium"
                        />
                        <Badge
                          variant={
                            item.confidence === "high"
                              ? "default"
                              : item.confidence === "medium"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-[10px]"
                        >
                          {item.confidence} confidence
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={() => removeItem(idx)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Cal</label>
                        <Input
                          type="number"
                          value={item.calories}
                          onChange={(e) => updateItem(idx, "calories", Number(e.target.value))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Protein</label>
                        <Input
                          type="number"
                          value={item.protein_g}
                          onChange={(e) => updateItem(idx, "protein_g", Number(e.target.value))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Carbs</label>
                        <Input
                          type="number"
                          value={item.carbs_g}
                          onChange={(e) => updateItem(idx, "carbs_g", Number(e.target.value))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Fat</label>
                        <Input
                          type="number"
                          value={item.fat_g}
                          onChange={(e) => updateItem(idx, "fat_g", Number(e.target.value))}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setCapturedImage(null);
                    setEstimationResult(null);
                    setEditingItems([]);
                  }}
                >
                  <X className="size-4" />
                  Discard
                </Button>
                <Button className="flex-1 gap-2" onClick={addAllItems}>
                  <Plus className="size-4" />
                  Add All ({editingItems.length})
                </Button>
              </div>
            </div>
          )}

          {estimationResult && editingItems.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              No food items detected. Try a different photo.
            </p>
          )}
        </>
      )}
    </div>
  );
}
