import { useState, useEffect, useCallback } from 'react';

const FIXER_API_KEY = import.meta.env.VITE_FIXER_API_KEY || '80f6690ad5c8e6aafe4373f4a0ce6e96';
const CACHE_KEY = 'eur_usd_rate_cache_v4'; // v4 to invalidate old cache
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

interface CachedRate {
  rate: number;
  timestamp: number;
}

export const useExchangeRate = () => {
  const [eurToUsd, setEurToUsd] = useState<number>(() => {
    // Try to load from cache on init
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { rate } = JSON.parse(cached) as CachedRate;
        return rate;
      }
    } catch {}
    return 1.08; // Default fallback
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchRate = useCallback(async (forceRefresh = false) => {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { rate, timestamp } = JSON.parse(cached) as CachedRate;
          if (Date.now() - timestamp < CACHE_DURATION) {
            setEurToUsd(rate);
            setIsLoading(false);
            return;
          }
        }
      } catch {}
    }

    setIsLoading(true);
    try {
      // Fixer.io API with HTTPS
      const response = await fetch(
        `https://data.fixer.io/api/latest?access_key=${FIXER_API_KEY}&symbols=USD`
      );
      const data = await response.json();

      if (data.success && data.rates?.USD) {
        const rate = data.rates.USD;
        setEurToUsd(rate);
        // Cache the result
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          rate,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.warn('Failed to fetch EUR/USD rate, using cached/fallback:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Manual refresh function
  const refreshRate = useCallback(() => {
    fetchRate(true);
  }, [fetchRate]);

  useEffect(() => {
    fetchRate();

    // Refresh every 6 hours (4 requests/day = ~120/month, but cache prevents most)
    const interval = setInterval(() => fetchRate(), CACHE_DURATION);

    return () => clearInterval(interval);
  }, [fetchRate]);

  return {
    eurToUsd,
    isLoading,
    refreshRate,
  };
};
