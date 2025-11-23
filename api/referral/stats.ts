import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TIER_CONFIG = [
  { name: "Bronze", minRefs: 0, multiplier: 0, emoji: "🥉" },
  { name: "Silver", minRefs: 5, multiplier: 0.1, emoji: "🥈" },
  { name: "Gold", minRefs: 10, multiplier: 0.2, emoji: "🥇" },
  { name: "Platinum", minRefs: 20, multiplier: 0.5, emoji: "💎" },
  { name: "Diamond", minRefs: 50, multiplier: 1.0, emoji: "👑" },
];

/**
 * API Endpoint: /api/referral/stats
 * Get referral stats for a user
 *
 * GET query: ?address=0x123...
 */
export default async function handler(request: any, response: any) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = request.query;

    // Validate address
    if (!address || typeof address !== 'string') {
      return response.status(400).json({ error: 'Address is required' });
    }

    // Validate Ethereum address format
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(address)) {
      return response.status(400).json({ error: 'Invalid Ethereum address format' });
    }

    const lowerAddress = address.toLowerCase();

    // Get referral stats from cache table
    const { data: stats, error: statsError } = await supabase
      .from('referral_stats')
      .select('*')
      .eq('referrer_address', lowerAddress)
      .single();

    // If no stats exist, return defaults
    if (!stats || statsError) {
      return response.status(200).json({
        address: lowerAddress,
        totalReferrals: 0,
        activeReferrals: 0,
        totalBonusPoints: 0,
        currentTier: 0,
        tierInfo: TIER_CONFIG[0],
        nextTierInfo: TIER_CONFIG[1],
        nextTierAt: TIER_CONFIG[1].minRefs,
      });
    }

    // Calculate next tier
    const currentTier = stats.current_tier;
    const nextTierIndex = Math.min(currentTier + 1, TIER_CONFIG.length - 1);
    const nextTierInfo = TIER_CONFIG[nextTierIndex];

    return response.status(200).json({
      address: lowerAddress,
      totalReferrals: stats.total_referrals,
      activeReferrals: stats.active_referrals,
      totalBonusPoints: stats.total_bonus_points,
      currentTier: stats.current_tier,
      tierInfo: TIER_CONFIG[currentTier],
      nextTierInfo,
      nextTierAt: nextTierInfo.minRefs,
    });
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
};
