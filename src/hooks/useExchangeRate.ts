import { useState, useEffect } from 'react';

export const useExchangeRate = () => {
  const [eurToUsd, setEurToUsd] = useState<number>(1.08); // Default fallback
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        // Using exchangerate-api.io free tier (no API key required)
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
        const data = await response.json();

        if (data && data.rates && data.rates.USD) {
          setEurToUsd(data.rates.USD);
        }
      } catch (error) {
        console.warn('Failed to fetch EUR/USD rate, using fallback:', error);
        // Keep the default/fallback rate
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchRate();

    // Refresh every hour
    const interval = setInterval(fetchRate, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    eurToUsd,
    isLoading,
  };
};
