import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * API Endpoint: /api/referral/list
 * Get list of referrals for a user
 *
 * GET query: ?address=0x123...&limit=10
 */
export default async function handler(request: any, response: any) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, limit = '10' } = request.query;

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
    const limitNum = parseInt(limit as string, 10) || 10;

    // Get referrals list
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('referee_address, created_at, first_deposit_at, total_points_earned, referrer_bonus_earned, is_active')
      .eq('referrer_address', lowerAddress)
      .order('created_at', { ascending: false })
      .limit(limitNum);

    if (error) {
      console.error('Supabase error:', error);
      return response.status(500).json({ error: 'Failed to fetch referrals' });
    }

    // Format referrals for frontend
    const formattedReferrals = (referrals || []).map(ref => ({
      address: ref.referee_address,
      joinedDate: ref.first_deposit_at || ref.created_at,
      pointsEarned: Number(ref.total_points_earned || 0),
      bonusEarned: Number(ref.referrer_bonus_earned || 0),
      isActive: ref.is_active,
    }));

    return response.status(200).json({
      success: true,
      count: formattedReferrals.length,
      referrals: formattedReferrals,
    });
  } catch (error) {
    console.error('Error fetching referral list:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
};
