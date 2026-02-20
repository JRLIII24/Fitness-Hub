"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useClips } from "@/hooks/use-clips";
import { CLIP_CATEGORIES } from "@/lib/clip-categories";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export default function UploadClipPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const { uploadClip } = useClips(userId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Thumbnail state
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbCaptured, setThumbCaptured] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      toast.error("Only MP4, MOV, or WebM videos are allowed.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      toast.error("Video must be under 500 MB.");
      return;
    }

    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
    setFile(selected);
    setDuration(null);
    setThumbnailBlob(null);
    setThumbnailPreview(null);
    setThumbCaptured(false);
  }

  function captureFrame() {
    const video = videoPreviewRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 360;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
      setThumbnailBlob(blob);
      setThumbnailPreview(URL.createObjectURL(blob));
      setThumbCaptured(true);
    }, "image/jpeg", 0.85);
  }

  function handleVideoLoaded() {
    const video = videoPreviewRef.current;
    if (!video) return;
    setDuration(video.duration);
    // Auto-seek to 10% of duration (or 1s) to auto-capture a preview frame
    video.currentTime = Math.min(1, video.duration * 0.1);
  }

  function handleSeeked() {
    // Auto-capture only on the initial seek (before user manually captures)
    if (!thumbCaptured) {
      captureFrame();
    }
  }

  async function handleUpload() {
    if (!file || !userId) return;

    setUploading(true);
    try {
      await uploadClip({
        videoFile: file,
        thumbnailBlob: thumbnailBlob ?? undefined,
        caption: caption.trim() || undefined,
        clipCategory: category ?? undefined,
        durationSeconds: duration ? Math.round(duration) : undefined,
      });
      toast.success("Clip posted!");
      router.push("/sets");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-5 pb-28 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-bold">Post a Set</h1>
      </div>

      {/* Video picker */}
      {!previewUrl ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full aspect-[9/16] max-h-[50svh] rounded-2xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-3 hover:bg-accent/50 transition-colors"
        >
          <div className="p-4 rounded-full bg-muted">
            <Video className="size-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm">Tap to choose a video</p>
            <p className="text-xs text-muted-foreground mt-1">
              MP4, MOV, or WebM · No length limit · Max 500 MB
            </p>
          </div>
        </button>
      ) : (
        <div className="relative w-full aspect-[9/16] max-h-[50svh] rounded-2xl overflow-hidden bg-black">
          <video
            ref={videoPreviewRef}
            src={previewUrl}
            className="w-full h-full object-cover"
            controls
            muted
            onLoadedMetadata={handleVideoLoaded}
            onSeeked={handleSeeked}
          />
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setPreviewUrl(null);
              setDuration(null);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white"
            aria-label="Remove video"
          >
            <X className="size-4" />
          </button>
          {duration !== null && (
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs">
              {Math.floor(duration / 60) > 0
                ? `${Math.floor(duration / 60)}m ${Math.round(duration % 60)}s`
                : `${Math.round(duration)}s`}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Thumbnail picker — only shown after a video is chosen */}
      {previewUrl && (
        <div className="space-y-2">
          <Label>Preview Thumbnail</Label>
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-[107px] rounded-lg overflow-hidden bg-black shrink-0 border border-border/60">
              {thumbnailPreview ? (
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="size-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-xs text-muted-foreground leading-snug">
                Pause the video and scrub to your desired moment, then tap{" "}
                <span className="font-medium text-foreground">Capture Frame</span>.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={captureFrame}
              >
                <Camera className="size-3.5" />
                Capture Frame
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Category picker */}
      <div className="space-y-2">
        <Label>Category</Label>
        <div className="flex flex-wrap gap-2">
          {CLIP_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() =>
                setCategory(category === cat.value ? null : cat.value)
              }
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium border transition-colors",
                category === cat.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/60 text-muted-foreground hover:bg-accent"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-1.5">
        <Label htmlFor="caption">Caption</Label>
        <Textarea
          id="caption"
          placeholder="What are you working on? (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={120}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground text-right">
          {caption.length}/120
        </p>
      </div>

      {/* Post button */}
      <Button
        className="w-full"
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? (
          "Uploading…"
        ) : (
          <>
            <Upload className="size-4 mr-2" />
            Post Set
          </>
        )}
      </Button>
    </div>
  );
}
