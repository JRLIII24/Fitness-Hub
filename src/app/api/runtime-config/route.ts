import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    maintenanceMode: process.env.MAINTENANCE_MODE === "true",
    disabledFeatures: process.env.DISABLED_FEATURES
      ? process.env.DISABLED_FEATURES.split(",").map((f) => f.trim())
      : [],
  });
}
