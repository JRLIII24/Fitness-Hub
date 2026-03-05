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
      <div className="relative overflow-hidden rounded-xl glass-surface bg-black aspect-[4/3] w-full">
        <div
          ref={scannerTargetRef}
          className={`h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover [&>canvas]:h-full [&>canvas]:w-full ${
            cameraActive ? "opacity-100" : "opacity-0"
          }`}
        />
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 glass-inner">
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
          <div className="glass-divider w-full" />
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
