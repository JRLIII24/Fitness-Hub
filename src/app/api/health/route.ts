import { NextResponse } from "next/server";

const MIN_NATIVE_VERSION = parseInt(
  process.env.NEXT_PUBLIC_NATIVE_MIN_VERSION ?? "1",
  10
);

export async function GET() {
  return NextResponse.json({
    status: "ok",
    minNativeVersion: MIN_NATIVE_VERSION,
    webVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    timestamp: Date.now(),
  });
}
