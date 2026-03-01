const isDev = process.env.NODE_ENV === "development";

export const logger = {
  log: isDev ? console.log.bind(console) : () => {},
  warn: isDev ? console.warn.bind(console) : () => {},
  // Errors always surface regardless of environment
  error: console.error.bind(console),
  debug: isDev ? console.debug.bind(console) : () => {},
};
