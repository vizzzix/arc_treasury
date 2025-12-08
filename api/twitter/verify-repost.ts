import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

// Our official tweet ID that users need to repost
const REQUIRED_TWEET_ID = process.env.TWITTER_REQUIRED_TWEET_ID || '1234567890123456789';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = request.body;

    if (!walletAddress) {
      return response.status(400).json({ error: 'Wallet address required' });
    }

    // Get Twitter connection
    const { data: connection, error: connError } = await supabase
      .from('twitter_connections')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (connError || !connection) {
      return response.status(400).json({ error: 'Twitter not connected' });
    }

    // Check if already verified
    if (connection.repost_verified) {
      return response.status(200).json({
        verified: true,
        multiplier: 1.5,
        message: 'Already verified',
      });
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) < new Date()) {
      // Refresh token
      const refreshed = await refreshTwitterToken(connection.refresh_token);
      if (!refreshed) {
        return response.status(400).json({ error: 'Token expired, please reconnect Twitter' });
      }
      accessToken = refreshed.access_token;

      // Update tokens in DB
      await supabase.from('twitter_connections').update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      }).eq('wallet_address', walletAddress.toLowerCase());
    }

    // Check if user retweeted our tweet
    // Twitter API v2: Get list of users who retweeted a specific tweet
    // Then check if current user's twitter_id is in that list
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

    // Check if API returned an error
    if (retweetersData.errors) {
      console.error('Twitter API error:', retweetersData.errors);
      return response.status(200).json({
        verified: false,
        multiplier: 1.0,
        message: 'Could not verify repost. Please try again later.',
      });
    }

    // Check if current user is in the list of retweeters
    const hasReposted = retweetersData.data?.some((user: any) =>
      user.id === connection.twitter_id
    ) || false;

    if (hasReposted) {
      // Update multiplier to 1.5x
      await supabase.from('twitter_connections').update({
        repost_verified: true,
        repost_verified_at: new Date().toISOString(),
        multiplier: 1.5,
      }).eq('wallet_address', walletAddress.toLowerCase());

      // Also update user_points multiplier
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
    const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || process.env.ClientID || '';
    const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || process.env.ClientSecret || '';

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
