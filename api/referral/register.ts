import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * API Endpoint: /api/referral/register
 * Register a referral relationship when referee makes first deposit
 *
 * POST body: {
 *   referrerAddress: string,  // Address of the referrer
 *   refereeAddress: string    // Address of the referee
 * }
 */
export default async function handler(request: any, response: any) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { referrerAddress, refereeAddress } = request.body;

    // Validate addresses
    if (!referrerAddress || !refereeAddress) {
      return response.status(400).json({ error: 'Referrer and referee addresses are required' });
    }

    // Validate Ethereum address format
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(referrerAddress) || !addressRegex.test(refereeAddress)) {
      return response.status(400).json({ error: 'Invalid Ethereum address format' });
    }

    // Cannot refer yourself
    if (referrerAddress.toLowerCase() === refereeAddress.toLowerCase()) {
      return response.status(400).json({ error: 'Cannot refer yourself' });
    }

    // Check if referee already exists (can only be referred once)
    const { data: existing, error: checkError } = await supabase
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

    // Create referral relationship
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
};
