import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || process.env.ClientID || '';
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || process.env.ClientSecret || '';
const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL || 'https://arctreasury.biz/api/twitter?action=callback';

const REQUIRED_TWEET_ID = process.env.TWITTER_REQUIRED_TWEET_ID || '1234567890123456789';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(request: any, response: any) {
  const { action } = request.query;

  switch (action) {
    case 'auth':
      return handleAuth(request, response);
    case 'callback':
      return handleCallback(request, response);
    case 'status':
      return handleStatus(request, response);
    case 'verify-repost':
      return handleVerifyRepost(request, response);
    default:
      return response.status(400).json({ error: 'Invalid action. Use: auth, callback, status, verify-repost' });
  }
}

async function handleAuth(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = request.body;

    if (!walletAddress) {
      return response.status(400).json({ error: 'Wallet address required' });
    }

    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const state = crypto.randomBytes(16).toString('hex');

    await supabase.from('twitter_auth_states').upsert({
      wallet_address: walletAddress.toLowerCase(),
      state,
      code_verifier: codeVerifier,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

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

async function handleCallback(request: any, response: any) {
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

    const { data: authState, error: dbError } = await supabase
      .from('twitter_auth_states')
      .select('*')
      .eq('state', state)
      .single();

    if (dbError || !authState) {
      return response.redirect('/profile?twitter=error&reason=invalid_state');
    }

    if (new Date(authState.expires_at) < new Date()) {
      await supabase.from('twitter_auth_states').delete().eq('state', state);
      return response.redirect('/profile?twitter=error&reason=expired');
    }

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

    await supabase.from('twitter_connections').upsert({
      wallet_address: authState.wallet_address,
      twitter_id: twitterUser.id,
      twitter_username: twitterUser.username,
      twitter_avatar: twitterUser.profile_image_url,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString(),
      multiplier: 1.0,
    });

    await supabase.from('twitter_auth_states').delete().eq('state', state);

    return response.redirect(`/profile?twitter=connected&username=${twitterUser.username}`);
  } catch (error) {
    console.error('Twitter callback error:', error);
    return response.redirect('/profile?twitter=error&reason=server_error');
  }
}

async function handleStatus(request: any, response: any) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = request.query;

    if (!walletAddress) {
      return response.status(400).json({ error: 'Wallet address required' });
    }

    const { data: connection } = await supabase
      .from('twitter_connections')
      .select('twitter_username, twitter_avatar, multiplier, repost_verified, connected_at')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (!connection) {
      return response.status(200).json({
        connected: false,
        multiplier: 1.0,
        tweetUrl: `https://twitter.com/arctreasury/status/${REQUIRED_TWEET_ID}`,
      });
    }

    return response.status(200).json({
      connected: true,
      username: connection.twitter_username,
      avatar: connection.twitter_avatar,
      multiplier: connection.multiplier || 1.0,
      repostVerified: connection.repost_verified || false,
      connectedAt: connection.connected_at,
      tweetUrl: `https://twitter.com/arctreasury/status/${REQUIRED_TWEET_ID}`,
    });
  } catch (error) {
    console.error('Twitter status error:', error);
    return response.status(500).json({ error: 'Failed to get Twitter status' });
  }
}

async function handleVerifyRepost(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = request.body;

    if (!walletAddress) {
      return response.status(400).json({ error: 'Wallet address required' });
    }

    const { data: connection, error: connError } = await supabase
      .from('twitter_connections')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (connError || !connection) {
      return response.status(400).json({ error: 'Twitter not connected' });
    }

    if (connection.repost_verified) {
      return response.status(200).json({
        verified: true,
        multiplier: 1.5,
        message: 'Already verified',
      });
    }

    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) < new Date()) {
      const refreshed = await refreshTwitterToken(connection.refresh_token);
      if (!refreshed) {
        return response.status(400).json({ error: 'Token expired, please reconnect Twitter' });
      }
      accessToken = refreshed.access_token;

      await supabase.from('twitter_connections').update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      }).eq('wallet_address', walletAddress.toLowerCase());
    }

    const retweetersResponse = await fetch(
      `https://api.twitter.com/2/tweets/${REQUIRED_TWEET_ID}/retweeted_by?max_results=100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    const retweetersData = await retweetersResponse.json();

    console.log('Retweeters API response:', JSON.stringify(retweetersData));

    if (retweetersData.errors) {
      console.error('Twitter API error:', retweetersData.errors);
      return response.status(200).json({
        verified: false,
        multiplier: 1.0,
        message: 'Could not verify repost. Please try again later.',
      });
    }

    const hasReposted = retweetersData.data?.some((user: any) =>
      user.id === connection.twitter_id
    ) || false;

    if (hasReposted) {
      await supabase.from('twitter_connections').update({
        repost_verified: true,
        repost_verified_at: new Date().toISOString(),
        multiplier: 1.5,
      }).eq('wallet_address', walletAddress.toLowerCase());

      await supabase.from('user_points').update({
        points_multiplier: 1.5,
      }).eq('wallet_address', walletAddress.toLowerCase());

      return response.status(200).json({
        verified: true,
        multiplier: 1.5,
        message: 'Repost verified! You now have 1.5x points multiplier!',
      });
    }

    return response.status(200).json({
      verified: false,
      multiplier: 1.0,
      message: 'Repost not found. Please repost the tweet and try again.',
      tweetUrl: `https://twitter.com/arctreasury/status/${REQUIRED_TWEET_ID}`,
    });
  } catch (error) {
    console.error('Verify repost error:', error);
    return response.status(500).json({ error: 'Failed to verify repost' });
  }
}

async function refreshTwitterToken(refreshToken: string) {
  try {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();
    if (data.access_token) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}
