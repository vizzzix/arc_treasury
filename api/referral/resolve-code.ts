import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * API Endpoint: /api/referral/resolve-code
 * Resolve a referral code to a wallet address
 *
 * GET query params: {
 *   code: string  // Referral code to resolve
 * }
 */
export default async function handler(request: any, response: any) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = request.query;

    // Validate code
    if (!code) {
      return response.status(400).json({ error: 'Code is required' });
    }

    // Validate code format (8 alphanumeric characters)
    const codeRegex = /^[A-Z2-9]{8}$/i;
    if (!codeRegex.test(code)) {
      return response.status(400).json({ error: 'Invalid referral code format' });
    }

    // Look up code in database
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
};
