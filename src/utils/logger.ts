const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log('[MRA]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn('[MRA]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[MRA]', ...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info('[MRA]', ...args);
  }
};
