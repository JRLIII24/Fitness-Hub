import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

export const logger = {
  log: isDev ? console.log.bind(console) : () => {},
  warn: isDev ? console.warn.bind(console) : () => {},
  error: (...args: unknown[]) => {
    console.error(...args);
    if (!isDev && args[0]) {
      const err =
        args[0] instanceof Error ? args[0] : new Error(String(args[0]));
      Sentry.captureException(err, {
        extra: args.length > 1 ? { additionalArgs: args.slice(1) } : undefined,
      });
    }
  },
  debug: isDev ? console.debug.bind(console) : () => {},
};
