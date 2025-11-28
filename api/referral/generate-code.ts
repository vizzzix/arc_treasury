import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Generate a unique referral code (8 characters alphanumeric)
 */
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters like 0, O, 1, I
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * API Endpoint: /api/referral/generate-code
 * Generate or retrieve a unique referral code for a user
 *
 * GET query params: {
 *   address: string  // User's wallet address
 * }
 */
export default async function handler(request: any, response: any) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = request.query;

    // Validate address
    if (!address) {
      return response.status(400).json({ error: 'Address is required' });
    }

    // Validate Ethereum address format
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(address)) {
      return response.status(400).json({ error: 'Invalid Ethereum address format' });
    }

    const normalizedAddress = address.toLowerCase();

    // Check if user already has a referral code
    const { data: existing, error: checkError } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('address', normalizedAddress)
      .single();

    if (existing) {
      // Return existing code
      return response.status(200).json({
        success: true,
        code: existing.code,
        isNew: false,
      });
    }

    // Generate new unique code
    let code = '';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      code = generateReferralCode();

      // Check if code already exists
      const { data: codeExists } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('code', code)
        .single();

      if (!codeExists) {
        break; // Code is unique
      }

      attempts++;
    }

    if (attempts === maxAttempts) {
      return response.status(500).json({ error: 'Failed to generate unique code' });
    }

    // Insert new referral code
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
};
