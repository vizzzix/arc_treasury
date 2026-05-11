import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const limiters = new Map<string, Ratelimit>();

function getLimiter(maxRequests: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;

  const cacheKey = `${maxRequests}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    const windowSec = `${Math.ceil(windowMs / 1000)} s` as `${number} s`;
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, windowSec),
      prefix: 'rl',
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

// In-memory fallback (resets on cold start)
const windows = new Map<string, { count: number; resetAt: number }>();

interface RateLimitInfo {
  remaining: number;
  resetAt: number;
}

const infoCache = new Map<string, RateLimitInfo>();

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<boolean> {
  const limiter = getLimiter(maxRequests, windowMs);

  if (limiter) {
    const { success, remaining, reset } = await limiter.limit(key);
    infoCache.set(key, { remaining, resetAt: reset });
    return success;
  }

  // Fallback: in-memory
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    infoCache.set(key, { remaining: maxRequests - 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  infoCache.set(key, { remaining, resetAt: entry.resetAt });
  return entry.count <= maxRequests;
}

export function getRateLimitHeaders(
  key: string,
  maxRequests: number,
): Record<string, string> {
  const info = infoCache.get(key);
  return {
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(info?.remaining ?? maxRequests),
    'X-RateLimit-Reset': String(info ? Math.ceil(info.resetAt / 1000) : 0),
  };
}
