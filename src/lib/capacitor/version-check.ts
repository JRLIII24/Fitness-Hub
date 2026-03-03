type CompatibilityResult = {
  compatible: boolean;
  nativeVersion: number | null;
  webVersion: string | null;
};

export async function checkNativeCompatibility(): Promise<CompatibilityResult> {
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    const nativeVersion = parseInt(info.build, 10);

    const res = await fetch("/api/health", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      return { compatible: true, nativeVersion, webVersion: null };
    }

    const health = await res.json();
    return {
      compatible: nativeVersion >= (health.minNativeVersion ?? 1),
      nativeVersion,
      webVersion: health.webVersion ?? null,
    };
  } catch {
    // Not in Capacitor or fetch failed — assume compatible
    return { compatible: true, nativeVersion: null, webVersion: null };
  }
}
