/**
 * Client-side video frame extractor.
 * Uses <video> + <canvas> to sample frames from an uploaded video file.
 *
 * Constraints:
 * - Max 8 frames
 * - JPEG quality 0.7
 * - Max dimension 1280px
 * - Total output <= 4MB
 *
 * Sampling strategy: weights the middle 60% of the video more heavily
 * since setup/rest happens at the start/end and actual reps are in the middle.
 */

import type { ExtractedFrame } from "./types";

const MAX_FRAMES = 8;
const MAX_DURATION = 60;
const JPEG_QUALITY = 0.7;
const MAX_DIMENSION = 1280;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/**
 * Build sample timestamps that weight the middle of the video.
 *
 * Strategy: allocate ~25% of frames to start/end regions (setup/rest),
 * ~75% to the middle region where reps happen.
 *
 * For 8 frames on a 30s video:
 *   - 1 frame in [0-6s]     (setup)
 *   - 6 frames in [6-24s]   (reps — middle 60%)
 *   - 1 frame in [24-30s]   (lockout/rest)
 */
function buildSampleTimes(duration: number, frameCount: number): number[] {
  if (frameCount <= 3) {
    // Too few frames — just distribute evenly
    return Array.from({ length: frameCount }, (_, i) =>
      duration * ((i + 0.5) / frameCount),
    );
  }

  const startRegion = duration * 0.2; // first 20%
  const endRegion = duration * 0.8;   // last 20%
  const middleStart = startRegion;
  const middleEnd = endRegion;

  // 1 frame in start, 1 in end, rest in middle
  const middleFrames = frameCount - 2;
  const times: number[] = [];

  // Start region: 1 frame at ~10% of video
  times.push(duration * 0.10);

  // Middle region: evenly distribute remaining frames
  for (let i = 0; i < middleFrames; i++) {
    const t = middleStart + (middleEnd - middleStart) * ((i + 0.5) / middleFrames);
    times.push(t);
  }

  // End region: 1 frame at ~90% of video
  times.push(duration * 0.90);

  return times.map((t) => Math.round(t * 10) / 10);
}

/**
 * Extract frames from a video file.
 * Returns base64-encoded JPEG frames with timestamps.
 */
export async function extractFrames(
  file: File,
  targetFrames?: number,
): Promise<{ frames: ExtractedFrame[]; duration: number }> {
  const url = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video"));
      video.src = url;
    });

    const duration = video.duration;
    if (!duration || duration < 1) {
      throw new Error("Video too short (minimum 1 second)");
    }
    if (duration > MAX_DURATION) {
      throw new Error("Video too long (maximum 60 seconds)");
    }

    const frameCount = Math.min(
      MAX_FRAMES,
      targetFrames ?? Math.min(MAX_FRAMES, Math.max(4, Math.round(duration / 4))),
    );

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    // Calculate scaled dimensions
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    canvas.width = width;
    canvas.height = height;

    const sampleTimes = buildSampleTimes(duration, frameCount);
    const frames: ExtractedFrame[] = [];
    let totalBytes = 0;

    for (let i = 0; i < sampleTimes.length; i++) {
      const t = sampleTimes[i];
      video.currentTime = t;

      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];
      const byteSize = (base64.length * 3) / 4;

      totalBytes += byteSize;
      if (totalBytes > MAX_TOTAL_BYTES) break;

      frames.push({
        timestampSeconds: Math.round(t * 10) / 10,
        mediaType: "image/jpeg",
        base64,
      });
    }

    return { frames, duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}
