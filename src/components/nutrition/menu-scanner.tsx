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
      const { data: profile } = await (supabase as any)
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
      const { data: foodItem, error: fiErr } = await (supabase as any)
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
