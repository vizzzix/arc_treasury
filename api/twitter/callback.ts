import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || process.env.ClientID || '';
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || process.env.ClientSecret || '';
const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL || 'https://arctreasury.biz/api/twitter/callback';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, state, error: oauthError } = request.query;

    if (oauthError) {
      return response.redirect('/profile?twitter=error&reason=' + oauthError);
    }

    if (!code || !state) {
      return response.redirect('/profile?twitter=error&reason=missing_params');
    }

    // Get stored state and code_verifier
    const { data: authState, error: dbError } = await supabase
      .from('twitter_auth_states')
      .select('*')
      .eq('state', state)
      .single();

    if (dbError || !authState) {
      return response.redirect('/profile?twitter=error&reason=invalid_state');
    }

    // Check expiration
    if (new Date(authState.expires_at) < new Date()) {
      await supabase.from('twitter_auth_states').delete().eq('state', state);
      return response.redirect('/profile?twitter=error&reason=expired');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: TWITTER_CLIENT_ID,
        redirect_uri: TWITTER_CALLBACK_URL,
        code_verifier: authState.code_verifier,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      console.error('Token exchange failed:', tokens);
      return response.redirect('/profile?twitter=error&reason=token_failed');
    }

    // Get Twitter user info
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=username,profile_image_url', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userData.data) {
      return response.redirect('/profile?twitter=error&reason=user_fetch_failed');
    }

    const twitterUser = userData.data;

    // Save Twitter connection to Supabase
    await supabase.from('twitter_connections').upsert({
      wallet_address: authState.wallet_address,
      twitter_id: twitterUser.id,
      twitter_username: twitterUser.username,
      twitter_avatar: twitterUser.profile_image_url,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString(),
      multiplier: 1.0, // Start with 1.0, becomes 1.5 after repost
    });

    // Clean up auth state
    await supabase.from('twitter_auth_states').delete().eq('state', state);

    // Redirect to profile with success
    return response.redirect(`/profile?twitter=connected&username=${twitterUser.username}`);
  } catch (error) {
    console.error('Twitter callback error:', error);
    return response.redirect('/profile?twitter=error&reason=server_error');
  }
}
