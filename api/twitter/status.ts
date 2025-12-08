import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

const REQUIRED_TWEET_ID = process.env.TWITTER_REQUIRED_TWEET_ID || '1234567890123456789';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = request.query;

    if (!walletAddress) {
      return response.status(400).json({ error: 'Wallet address required' });
    }

    // Get Twitter connection
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
