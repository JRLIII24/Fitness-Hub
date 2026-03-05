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
