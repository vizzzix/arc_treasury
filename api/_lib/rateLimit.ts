// Simple in-memory sliding window rate limiter for Vercel serverless
// Note: each cold start resets the window, but within a warm instance this limits burst abuse

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  windows.forEach((entry, key) => {
    if (now > entry.resetAt) windows.delete(key);
  });
}

/**
 * Check if a request should be rate-limited.
 * @returns true if the request is allowed, false if rate-limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  cleanup();
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

export function getRateLimitHeaders(
  key: string,
  maxRequests: number,
): Record<string, string> {
  const entry = windows.get(key);
  const remaining = entry ? Math.max(0, maxRequests - entry.count) : maxRequests;
  const reset = entry ? Math.ceil(entry.resetAt / 1000) : 0;
  return {
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  };
}
