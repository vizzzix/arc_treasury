import { useState, useEffect, useCallback } from 'react';

const FIXER_API_KEY = import.meta.env.VITE_FIXER_API_KEY || '80f6690ad5c8e6aafe4373f4a0ce6e96';
const CACHE_KEY = 'eur_usd_rate_cache_v4';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

interface CachedRate {
  rate: number;
  timestamp: number;
}

function getCachedRate(): CachedRate | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as CachedRate;
    if (Date.now() - parsed.timestamp < CACHE_DURATION) return parsed;
  } catch {}
  return null;
}

// Module-level deduplication: all hook instances share one in-flight request
let pendingFetch: Promise<number | null> | null = null;

async function fetchRateOnce(): Promise<number | null> {
  try {
    const response = await fetch(
      `https://data.fixer.io/api/latest?access_key=${FIXER_API_KEY}&symbols=USD`
    );
    const data = await response.json();
    if (data.success && data.rates?.USD) {
      const rate = data.rates.USD;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, timestamp: Date.now() }));
      return rate;
    }
  } catch (error) {
    console.warn('Failed to fetch EUR/USD rate:', error);
  }
  return null;
}

function deduplicatedFetch(): Promise<number | null> {
  if (!pendingFetch) {
    pendingFetch = fetchRateOnce().finally(() => { pendingFetch = null; });
  }
  return pendingFetch;
}

export const useExchangeRate = () => {
  const [eurToUsd, setEurToUsd] = useState<number>(() => {
    return getCachedRate()?.rate ?? 1.08;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchRate = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedRate();
      if (cached) {
        setEurToUsd(cached.rate);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    const rate = await deduplicatedFetch();
    if (rate) setEurToUsd(rate);
    setIsLoading(false);
  }, []);

  const refreshRate = useCallback(() => {
    fetchRate(true);
  }, [fetchRate]);

  useEffect(() => {
    fetchRate();
    const interval = setInterval(() => fetchRate(), CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchRate]);

  return { eurToUsd, isLoading, refreshRate };
};
