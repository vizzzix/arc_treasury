/**
 * Vercel Serverless Function to proxy USYC price data from Hashnote API
 *
 * This endpoint bypasses CORS restrictions by making server-side requests
 * to the Hashnote API and returning the data to the client.
 *
 * APY Calculation:
 * - Uses historical NAV data to calculate real annualized return
 * - Compares oldest and newest price in the dataset
 * - Annualizes based on actual time elapsed
 *
 * Endpoint: /api/usyc-price
 * Method: GET
 * Response: { price: number, apy: number, asOf: string }
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[API] Fetching USYC price from Hashnote API...');

    const response = await fetch('https://usyc.hashnote.com/api/price-reports', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Arc-Treasury/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Hashnote API error: ${response.status}`);
    }

    const responseData = await response.json();
    console.log('[API] Successfully fetched USYC price');

    const data = responseData.data;
    if (!data || data.length === 0) {
      return res.status(500).json({
        error: 'No price data available'
      });
    }

    // Get latest (first) and oldest (last) price reports
    const latestReport = data[0];
    const oldestReport = data[data.length - 1];

    const currentPrice = parseFloat(latestReport.price);
    const oldestPrice = parseFloat(oldestReport.price);
    const latestTimestamp = parseInt(latestReport.timestamp);
    const oldestTimestamp = parseInt(oldestReport.timestamp);

    // Calculate time elapsed in years
    const secondsElapsed = latestTimestamp - oldestTimestamp;
    const yearsElapsed = secondsElapsed / (365.25 * 24 * 60 * 60);

    // Calculate real APY from historical price change
    // APY = ((endPrice / startPrice) ^ (1 / years)) - 1
    let apy = 4.0; // Default fallback
    if (yearsElapsed > 0 && oldestPrice > 0) {
      const totalReturn = currentPrice / oldestPrice;
      apy = (Math.pow(totalReturn, 1 / yearsElapsed) - 1) * 100;
    }

    console.log('[API] APY calculation:', {
      currentPrice,
      oldestPrice,
      yearsElapsed: yearsElapsed.toFixed(2),
      apy: apy.toFixed(2) + '%'
    });

    // Set CORS headers to allow requests from our frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Cache for 1 hour (APY doesn't change frequently)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

    // Return the price data with calculated APY
    return res.status(200).json({
      price: currentPrice,
      apy: Math.round(apy * 100) / 100, // Round to 2 decimal places
      asOf: latestReport.timestamp,
    });
  } catch (error) {
    console.error('[API] Error fetching USYC price:', error);

    return res.status(500).json({
      error: 'Failed to fetch USYC price',
      message: error.message || 'Unknown error'
    });
  }
}
