import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.5,

  beforeSend(event) {
    const isCapacitor =
      typeof window !== "undefined" &&
      !!(window as unknown as Record<string, unknown>).Capacitor;

    event.tags = {
      ...event.tags,
      platform: isCapacitor ? "capacitor" : "web",
    };

    // Scrub PII: strip authorization headers
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.Authorization;
    }

    // Truncate large request bodies
    if (event.request?.data && typeof event.request.data === "string" && event.request.data.length > 1000) {
      event.request.data = event.request.data.slice(0, 1000) + "...[truncated]";
    }

    return event;
  },

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
});
