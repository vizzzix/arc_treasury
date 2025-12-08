import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface TwitterStatus {
  connected: boolean;
  username?: string;
  avatar?: string;
  multiplier: number;
  repostVerified: boolean;
  tweetUrl?: string;
}

const TwitterConnect = () => {
  const { address } = useAccount();
  const [status, setStatus] = useState<TwitterStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Twitter connection status
  useEffect(() => {
    if (!address) {
      setStatus(null);
      return;
    }

    fetchStatus();
  }, [address]);

  // Check URL params for callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const twitterResult = params.get('twitter');

    if (twitterResult === 'connected') {
      fetchStatus();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (twitterResult === 'error') {
      setError('Failed to connect Twitter. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchStatus = async () => {
    if (!address) return;

    try {
      const res = await fetch(`/api/twitter/status?walletAddress=${address}`);
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch Twitter status:', err);
    }
  };

  const connectTwitter = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/twitter/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });

      const data = await res.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError('Failed to get auth URL');
      }
    } catch (err) {
      setError('Failed to connect Twitter');
    } finally {
      setLoading(false);
    }
  };

  const verifyRepost = async () => {
    if (!address) return;

    setVerifying(true);
    setError(null);

    try {
      const res = await fetch('/api/twitter/verify-repost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });

      const data = await res.json();

      if (data.verified) {
        setStatus(prev => prev ? { ...prev, repostVerified: true, multiplier: 1.5 } : null);
      } else {
        setError(data.message || 'Repost not found. Please repost and try again.');
      }
    } catch (err) {
      setError('Failed to verify repost');
    } finally {
      setVerifying(false);
    }
  };

  if (!address) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#1DA1F2]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Twitter Boost</h3>
            <p className="text-sm text-muted-foreground">Connect wallet first</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1DA1F2]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Twitter Boost</h3>
            <p className="text-sm text-muted-foreground">
              {status?.repostVerified ? '1.5x multiplier active!' : 'Get 1.5x points multiplier'}
            </p>
          </div>
        </div>

        {status?.repostVerified && (
          <div className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
            1.5x Active
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Not Connected */}
      {!status?.connected && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your Twitter account and repost our announcement to unlock a <span className="text-primary font-semibold">1.5x points multiplier</span> on all your activities!
          </p>

          <button
            onClick={connectTwitter}
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Connect Twitter
              </>
            )}
          </button>
        </div>
      )}

      {/* Connected but not verified */}
      {status?.connected && !status.repostVerified && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            {status.avatar && (
              <img src={status.avatar} alt="" className="w-10 h-10 rounded-full" />
            )}
            <div>
              <p className="font-medium text-foreground">@{status.username}</p>
              <p className="text-xs text-green-500">Connected</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-foreground mb-3">
              <span className="font-semibold">Step 2:</span> Repost our tweet to activate your 1.5x multiplier!
            </p>

            <div className="flex gap-2">
              <a
                href={status.tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-4 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-sm font-medium transition-colors text-center"
              >
                View Tweet
              </a>
              <button
                onClick={verifyRepost}
                disabled={verifying}
                className="flex-1 py-2 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Repost'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fully verified */}
      {status?.connected && status.repostVerified && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            {status.avatar && (
              <img src={status.avatar} alt="" className="w-10 h-10 rounded-full" />
            )}
            <div className="flex-1">
              <p className="font-medium text-foreground">@{status.username}</p>
              <p className="text-xs text-green-500">Verified • 1.5x Multiplier Active</p>
            </div>
            <div className="text-2xl">🎉</div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            All your points now earn <span className="text-primary font-semibold">50% bonus</span>!
          </p>
        </div>
      )}
    </div>
  );
};

export default TwitterConnect;
