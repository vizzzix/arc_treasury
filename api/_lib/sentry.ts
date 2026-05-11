import * as Sentry from '@sentry/node';

const DSN = process.env.SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV || 'development',
    tracesSampleRate: 0.2,
    beforeSend(event) {
      if (event.exception?.values?.some(v =>
        v.value?.includes('rate limit') ||
        v.value?.includes('Too many requests')
      )) {
        return null;
      }
      return event;
    },
  });
}

export { Sentry };

export function captureApiError(error: unknown, context: Record<string, unknown> = {}) {
  if (!DSN) return;
  Sentry.withScope(scope => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    Sentry.captureException(error);
  });
}
