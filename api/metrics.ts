import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VALID_TOKENS = [
  'hivemind-dec2025',
  'dcvc-dec2025',
  '1kx-dec2025',
  'investor-seed-2025',
  'investor-seed-2026',
  'arc-treasury-pitch',
];

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = request.query;
  if (!token || !VALID_TOKENS.includes(token)) {
    return response.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const [
      qualityUsersResult,
      totalUsersResult,
      referralCodesResult,
      referralsResult,
      twitterResult,
      bridgesResult,
      bridgeVolumeResult,
      totalTxResult,
      swapVolumeResult,
      badgeMintResult,
    ] = await Promise.all([
      // Quality users: have vault/swap/liquidity activity
      supabase
        .from('user_points')
        .select('*', { count: 'exact', head: true })
        .or('vault_volume.gt.0,swap_volume.gt.0,liquidity_volume.gt.0'),

      // Total users in user_points
      supabase
        .from('user_points')
        .select('*', { count: 'exact', head: true }),

      // Referral codes created
      supabase
        .from('referral_codes')
        .select('*', { count: 'exact', head: true }),

      // Referrals completed
      supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true }),

      // Twitter-connected users
      supabase
        .from('twitter_connections')
        .select('*', { count: 'exact', head: true }),

      // Site bridges count
      supabase
        .from('site_bridges')
        .select('*', { count: 'exact', head: true }),

      // Total bridge volume (sum of amount from site_bridges)
      supabase
        .from('site_bridges')
        .select('amount'),

      // Total transactions tracked
      supabase
        .from('circle_transactions')
        .select('*', { count: 'exact', head: true }),

      // Top swap/liquidity volumes from user_points
      supabase
        .from('user_points')
        .select('swap_volume, liquidity_volume, vault_volume, bridge_volume'),

      // Badge mints
      supabase
        .from('circle_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('tx_type', 'mint-badge'),
    ]);

    // Calculate total volumes
    const volumeData = swapVolumeResult.data || [];
    const totalSwapVolume = volumeData.reduce((sum: number, r: any) => sum + (r.swap_volume || 0), 0);
    const totalLiquidityVolume = volumeData.reduce((sum: number, r: any) => sum + (r.liquidity_volume || 0), 0);
    const totalVaultVolume = volumeData.reduce((sum: number, r: any) => sum + (r.vault_volume || 0), 0);
    const totalBridgeVolume = volumeData.reduce((sum: number, r: any) => sum + (r.bridge_volume || 0), 0);

    // Bridge volume from site_bridges (amount in USD)
    const siteBridgeVolume = (bridgeVolumeResult.data || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0
    );

    const metrics = {
      qualityUsers: qualityUsersResult.count || 0,
      totalTrackedUsers: totalUsersResult.count || 0,
      referralCodes: referralCodesResult.count || 0,
      referrals: referralsResult.count || 0,
      twitterConnected: twitterResult.count || 0,
      siteBridges: bridgesResult.count || 0,
      siteBridgeVolume: Math.round(siteBridgeVolume),
      totalTransactions: totalTxResult.count || 0,
      badgeMints: badgeMintResult.count || 0,
      smartContracts: 9,
      volumes: {
        swap: Math.round(totalSwapVolume),
        liquidity: Math.round(totalLiquidityVolume),
        vault: Math.round(totalVaultVolume),
        bridge: Math.round(totalBridgeVolume),
      },
      generatedAt: new Date().toISOString(),
    };

    response.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return response.status(200).json(metrics);
  } catch (err: any) {
    console.error('[Metrics] Error:', err);
    return response.status(500).json({ error: 'Failed to fetch metrics' });
  }
}
