import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Loader2, Shield } from 'lucide-react';

interface TwitterStatus {
  connected: boolean;
  username?: string;
  avatar?: string;
  multiplier: number;
  repostVerified: boolean;
  tweetUrl?: string;
}

// X (Twitter) icon component
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

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
      const res = await fetch(`/api/twitter?action=status&walletAddress=${address}`);
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
      const res = await fetch('/api/twitter?action=auth', {
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
      const res = await fetch('/api/twitter?action=verify-repost', {
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
      <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <XIcon className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Twitter Boost</h3>
        </div>
        <p className="text-sm text-muted-foreground">Connect wallet first</p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <XIcon className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Twitter Boost</h3>
        </div>

        {status?.repostVerified && (
          <div className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            1.5x Active
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {status?.repostVerified ? 'Your 1.5x multiplier is active!' : 'Get 1.5x points multiplier'}
      </p>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Not Connected */}
      {!status?.connected && (
        <div className="space-y-3">
          <Button
            onClick={connectTwitter}
            disabled={loading}
            className="w-full rounded-xl h-11 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Connecting...
              </>
            ) : (
              <>
                <XIcon className="w-4 h-4 mr-2" />
                Connect Twitter
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Connect and repost our tweet to unlock bonus
          </p>
        </div>
      )}

      {/* Connected but not verified */}
      {status?.connected && !status.repostVerified && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-3">
              {status.avatar && (
                <img src={status.avatar} alt="" className="w-10 h-10 rounded-full" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-3 h-3 text-green-400" />
                  <p className="text-xs text-green-400 font-medium">Connected</p>
                </div>
                <p className="text-sm truncate">@{status.username}</p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-sm text-foreground mb-3">
              Repost our tweet to activate your <span className="text-primary font-semibold">1.5x multiplier</span>
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11"
                onClick={() => window.open(status.tweetUrl, '_blank')}
              >
                View Tweet
              </Button>
              <Button
                onClick={verifyRepost}
                disabled={verifying}
                className="flex-1 rounded-xl h-11"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  'Verify Repost'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fully verified */}
      {status?.connected && status.repostVerified && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-3">
              {status.avatar && (
                <img src={status.avatar} alt="" className="w-10 h-10 rounded-full" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-3 h-3 text-green-400" />
                  <p className="text-xs text-green-400 font-medium">Verified • 1.5x Active</p>
                </div>
                <p className="text-sm truncate">@{status.username}</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            All your points now earn <span className="text-primary font-medium">50% bonus</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default TwitterConnect;
