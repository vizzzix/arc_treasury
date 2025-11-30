import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, walletAddress, code } = request.body;

    if (!email || !walletAddress || !code) {
      return response.status(400).json({ error: 'Email, wallet address, and code required' });
    }

    // Get stored code from Supabase
    const { data, error: dbError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('email', email.toLowerCase())
      .single();

    if (dbError || !data) {
      return response.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      await supabase
        .from('email_verification_codes')
        .delete()
        .eq('wallet_address', walletAddress.toLowerCase());
      return response.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }

    // Check if code matches
    if (data.code !== code) {
      return response.status(400).json({ error: 'Invalid verification code' });
    }

    // Code is valid - delete it
    await supabase
      .from('email_verification_codes')
      .delete()
      .eq('wallet_address', walletAddress.toLowerCase());

    return response.status(200).json({
      success: true,
      message: 'Email verified successfully',
      verified: true
    });
  } catch (error) {
    console.error('Error verifying code:', error);
    return response.status(500).json({ error: 'Failed to verify code' });
  }
}
