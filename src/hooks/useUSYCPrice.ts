import { useState, useEffect } from 'react';
import { USYC_REFERENCE_APY } from '@/lib/constants';

interface USYCPriceData {
  price: number;
  apy: number;
  lastUpdated: string;
}

export const useUSYCPrice = () => {
  const [data, setData] = useState<USYCPriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchUSYCPrice = async () => {
      try {
        // Use our Vercel API endpoint to bypass CORS
        const response = await fetch('/api/usyc-price');

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const apiData = await response.json();

        // API now returns pre-calculated APY from historical data
        const currentPrice = parseFloat(apiData.price || '0');
        const apy = parseFloat(apiData.apy || '0');

        if (currentPrice === 0) {
          throw new Error('Invalid price data from API');
        }

        if (isMounted) {
          setData({
            price: currentPrice,
            apy: apy,
            lastUpdated: new Date().toISOString(),
          });
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        // Only log non-429 errors to avoid console spam
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (!errorMessage.includes('429') && !errorMessage.includes('Rate limit')) {
          console.error('[useUSYCPrice] Error fetching USYC price:', err);
        }

        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch USYC price');
          setIsLoading(false);

          // Fallback to hardcoded APY on error
          setData({
            price: 0,
            apy: USYC_REFERENCE_APY,
            lastUpdated: new Date().toISOString(),
          });
        }
      }
    };

    // Fetch immediately on mount
    fetchUSYCPrice();

    // Poll every hour to get updated APY
    const intervalId = setInterval(fetchUSYCPrice, 3600000); // 1 hour = 3600000ms

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return {
    price: data?.price || 0,
    apy: data?.apy || USYC_REFERENCE_APY, // Fallback to hardcoded value
    lastUpdated: data?.lastUpdated || '',
    isLoading,
    error,
  };
};
