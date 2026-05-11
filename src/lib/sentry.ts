import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    beforeSend(event) {
      if (event.exception?.values?.some(v =>
        v.value?.includes('Loading chunk') ||
        v.value?.includes('dynamically imported module') ||
        v.value?.includes('Failed to fetch')
      )) {
        return null;
      }
      return event;
    },
  });
}

export { Sentry };
