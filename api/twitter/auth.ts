import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || '';
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || '';
const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL || 'https://arctreasury.biz/api/twitter/callback';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Twitter OAuth 2.0 PKCE flow
export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = request.body;

    if (!walletAddress) {
      return response.status(400).json({ error: 'Wallet address required' });
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Store in Supabase for callback verification
    await supabase.from('twitter_auth_states').upsert({
      wallet_address: walletAddress.toLowerCase(),
      state,
      code_verifier: codeVerifier,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
    });

    // Build Twitter OAuth URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: TWITTER_CALLBACK_URL,
      scope: 'tweet.read users.read follows.read like.read',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

    return response.status(200).json({ authUrl, state });
  } catch (error) {
    console.error('Twitter auth error:', error);
    return response.status(500).json({ error: 'Failed to initiate Twitter auth' });
  }
}
