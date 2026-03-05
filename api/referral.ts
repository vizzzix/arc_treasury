import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Referral] SUPABASE_SERVICE_ROLE_KEY not set, using SUPABASE_KEY (writes may fail with RLS)');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TIER_CONFIG = [
  { name: "Bronze", minRefs: 0, multiplier: 0, emoji: "🥉" },
  { name: "Silver", minRefs: 5, multiplier: 0.1, emoji: "🥈" },
  { name: "Gold", minRefs: 10, multiplier: 0.2, emoji: "🥇" },
  { name: "Platinum", minRefs: 20, multiplier: 0.5, emoji: "💎" },
  { name: "Diamond", minRefs: 50, multiplier: 1.0, emoji: "👑" },
];

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}

const addressRegex = /^0x[a-fA-F0-9]{40}$/;

export default async function handler(request: any, response: any) {
  const { action } = request.query;

  switch (action) {
    case 'generate-code':
      return handleGenerateCode(request, response);
    case 'resolve-code':
      return handleResolveCode(request, response);
    case 'list':
      return handleList(request, response);
    case 'register':
      return handleRegister(request, response);
    case 'stats':
      return handleStats(request, response);
    default:
      return response.status(400).json({ error: 'Invalid action. Use: generate-code, resolve-code, list, register, stats' });
  }
}

async function handleGenerateCode(request: any, response: any) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = request.query;

    if (!address) {
      return response.status(400).json({ error: 'Address is required' });
    }

    if (!addressRegex.test(address)) {
      return response.status(400).json({ error: 'Invalid Ethereum address format' });
    }

    const normalizedAddress = address.toLowerCase();

    const { data: existing } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('address', normalizedAddress)
      .single();

    if (existing) {
      return response.status(200).json({
        success: true,
        code: existing.code,
        isNew: false,
      });
    }

    let code = '';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      code = generateReferralCode();

      const { data: codeExists } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('code', code)
        .single();

      if (!codeExists) {
        break;
      }

      attempts++;
    }

    if (attempts === maxAttempts) {
      return response.status(500).json({ error: 'Failed to generate unique code' });
    }

    const { data, error } = await supabase
      .from('referral_codes')
      .insert([{
        address: normalizedAddress,
        code: code,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return response.status(500).json({ error: 'Failed to save referral code' });
    }

    return response.status(200).json({
      success: true,
      code: data.code,
      isNew: true,
    });
  } catch (error) {
    console.error('Error generating referral code:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}

async function handleResolveCode(request: any, response: any) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = request.query;

    if (!code) {
      return response.status(400).json({ error: 'Code is required' });
    }

    const codeRegex = /^[A-Z2-9]{8}$/i;
    if (!codeRegex.test(code)) {
      return response.status(400).json({ error: 'Invalid referral code format' });
    }

    const { data, error } = await supabase
      .from('referral_codes')
      .select('address')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !data) {
      return response.status(404).json({ error: 'Referral code not found' });
    }

    return response.status(200).json({
      success: true,
      address: data.address,
    });
  } catch (error) {
    console.error('Error resolving referral code:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}

async function handleList(request: any, response: any) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, limit = '10' } = request.query;

    if (!address || typeof address !== 'string') {
      return response.status(400).json({ error: 'Address is required' });
    }

    if (!addressRegex.test(address)) {
      return response.status(400).json({ error: 'Invalid Ethereum address format' });
    }

    const lowerAddress = address.toLowerCase();
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 10, 1), 100);

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
}

async function handleRegister(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { referrerAddress, refereeAddress } = request.body;

    if (!referrerAddress || !refereeAddress) {
      return response.status(400).json({ error: 'Referrer and referee addresses are required' });
    }

    if (!addressRegex.test(referrerAddress) || !addressRegex.test(refereeAddress)) {
      return response.status(400).json({ error: 'Invalid Ethereum address format' });
    }

    if (referrerAddress.toLowerCase() === refereeAddress.toLowerCase()) {
      return response.status(400).json({ error: 'Cannot refer yourself' });
    }

    const { data: existing } = await supabase
      .from('referrals')
      .select('id, referrer_address')
      .eq('referee_address', refereeAddress.toLowerCase())
      .single();

    if (existing) {
      return response.status(409).json({
        error: 'Address already referred',
        existingReferrer: existing.referrer_address
      });
    }

    const { data, error } = await supabase
      .from('referrals')
      .insert([{
        referrer_address: referrerAddress.toLowerCase(),
        referee_address: refereeAddress.toLowerCase(),
        first_deposit_at: new Date().toISOString(),
        total_points_earned: 0,
        referrer_bonus_earned: 0,
        is_active: true,
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return response.status(500).json({ error: 'Failed to register referral' });
    }

    return response.status(200).json({
      success: true,
      message: 'Referral registered successfully',
      data,
    });
  } catch (error) {
    console.error('Error registering referral:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}

async function handleStats(request: any, response: any) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = request.query;

    if (!address || typeof address !== 'string') {
      return response.status(400).json({ error: 'Address is required' });
    }

    if (!addressRegex.test(address)) {
      return response.status(400).json({ error: 'Invalid Ethereum address format' });
    }

    const lowerAddress = address.toLowerCase();

    const { data: stats, error: statsError } = await supabase
      .from('referral_stats')
      .select('*')
      .eq('referrer_address', lowerAddress)
      .single();

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
}
