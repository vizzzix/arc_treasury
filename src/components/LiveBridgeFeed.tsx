import { useState, useEffect, useCallback } from 'react';
import { useBridgeFeed, BridgeTransaction, TopBridger } from '@/hooks/useBridgeFeed';
import { useLeaderboardMessages } from '@/hooks/useLeaderboardMessages';
import { RefreshCw, Activity, Trophy, X, Edit3, MessageSquare, Sparkles, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAccount } from 'wagmi';

// Moderator wallets - can delete any message
const MODERATOR_WALLETS = [
  '0xB66D4229Bb5A82De94610d63677cF5370e6a81cb',
].map(addr => addr.toLowerCase());

// Simple confetti component (contained within parent)
const Confetti = ({ active }: { active: boolean }) => {
  if (!active) return null;

  const confettiPieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 1.5 + Math.random() * 1,
    color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'][Math.floor(Math.random() * 8)],
    size: 4 + Math.random() * 4,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none z-[60] overflow-hidden rounded-2xl">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-local"
          style={{
            left: `${piece.left}%`,
            top: '-10px',
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-local {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-local {
          animation: confetti-local linear forwards;
        }
      `}</style>
    </div>
  );
};

// Top 10 Celebration Popup
interface Top10CelebrationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  rank: number;
  onAddMessage: () => void;
}

const Top10CelebrationPopup = ({ isOpen, onClose, rank, onAddMessage }: Top10CelebrationPopupProps) => {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <Confetti active={showConfetti} />
      <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 rounded-2xl p-3">
        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30 rounded-xl p-4 w-full shadow-xl backdrop-blur-sm animate-in zoom-in-95 duration-300">
          <div className="text-center">
            <div className="mb-2">
              <Sparkles className="w-10 h-10 mx-auto text-yellow-500 animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-yellow-500 mb-1">
              Congratulations!
            </h2>
            <p className="text-sm text-foreground mb-1">
              You're now #{rank} in Top Bridgers!
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Leave a message for the leaderboard!
            </p>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-3 py-2 text-xs border border-border rounded-lg hover:bg-white/5 transition-colors"
              >
                Later
              </button>
              <button
                onClick={() => {
                  onClose();
                  onAddMessage();
                }}
                className="flex-1 px-3 py-2 text-xs bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-400 transition-colors"
              >
                Add Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatAmount = (amount: number, showDecimals = false) => {
  if (showDecimals && amount < 100) {
    const rounded = Math.round(amount);
    const isCloseToWhole = Math.abs(amount - rounded) < 0.01;
    if (isCloseToWhole) {
      return `$${rounded.toLocaleString('en-US')}`;
    }
    const roundedOne = Math.round(amount * 10) / 10;
    const isCloseToOneDecimal = Math.abs(amount - roundedOne) < 0.01;
    if (isCloseToOneDecimal) {
      return `$${roundedOne}`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${Math.round(amount).toLocaleString('en-US')}`;
};

const getTierBadge = (amount: number): string => {
  if (amount >= 50000) return '🐋';
  if (amount >= 10000) return '🦈';
  if (amount >= 1000) return '🐬';
  if (amount >= 100) return '🐟';
  return '🦐';
};

interface TransactionRowProps {
  tx: BridgeTransaction;
  isTop10: boolean;
}

const TransactionRow = ({ tx, isTop10 }: TransactionRowProps) => {
  const isToArc = tx.direction === 'to_arc';
  const timeAgo = formatDistanceToNow(new Date(tx.created_at), { addSuffix: false });

  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors text-xs ${isTop10 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/[0.02] hover:bg-white/[0.05]'}`}>
      {isTop10 && <span className="text-yellow-500">👑</span>}
      <span className={`font-mono ${isTop10 ? 'text-yellow-500 font-medium' : 'text-foreground/70'}`}>{formatAddress(tx.wallet_address)}</span>
      <span className="text-muted-foreground">{formatAmount(tx.amount_usd, true)}</span>
      <span>{getTierBadge(tx.amount_usd)}</span>
      <span className={`${isToArc ? 'text-green-400' : 'text-blue-400'}`}>
        {isToArc ? 'Sep→Arc' : 'Arc→Sep'}
      </span>
      <span className="ml-auto text-muted-foreground/60">{timeAgo}</span>
    </div>
  );
};

interface MessageInputPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (message: string) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  currentMessage?: string | null;
  maxLength: number;
  isSaving: boolean;
}

const MessageInputPopup = ({ isOpen, onClose, onSave, onDelete, currentMessage, maxLength, isSaving }: MessageInputPopupProps) => {
  const [message, setMessage] = useState(currentMessage || '');
  const isEditing = !!currentMessage;

  const handleDelete = async () => {
    if (onDelete) {
      const success = await onDelete();
      if (success) onClose();
    }
  };

  useEffect(() => {
    setMessage(currentMessage || '');
  }, [currentMessage, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const success = await onSave(message);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{isEditing ? '✏️' : '🎉'}</span>
            <h3 className="font-semibold">{isEditing ? 'Edit Your Message' : "You're in Top 10!"}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isEditing && (
          <p className="text-sm text-muted-foreground mb-4">
            Leave a message for the leaderboard. Everyone will see it!
          </p>
        )}

        <div className="relative mb-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
            placeholder="gm frens! WAGMI 🚀"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={maxLength}
            autoFocus
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {message.length}/{maxLength}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-border rounded-xl hover:bg-white/5 transition-colors"
          >
            {isEditing ? 'Cancel' : 'Skip'}
          </button>
          {isEditing && onDelete && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="px-4 py-2 text-sm border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {isSaving ? '...' : 'Delete'}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !message.trim()}
            className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const LiveBridgeFeed = () => {
  const { transactions, stats, topBridgers, allBridgersRanked, getUserRank, isLoading, refresh } = useBridgeFeed(20);
  const { getMessage, saveMessage, deleteMessage, isSaving, MAX_MESSAGE_LENGTH } = useLeaderboardMessages('bridge');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [showMessagePopup, setShowMessagePopup] = useState(false);
  const [showCelebrationPopup, setShowCelebrationPopup] = useState(false);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [previousRank, setPreviousRank] = useState<number | null>(null);
  const [hasShownCelebration, setHasShownCelebration] = useState(false);
  const { address } = useAccount();

  // Dev mode: ?devMode=true in URL makes current user appear in top 10
  // Test mode: ?testTop10Popup=true opens celebration popup immediately
  const searchParams = new URLSearchParams(window.location.search);
  const devMode = searchParams.get('devMode') === 'true';
  const testTop10Popup = searchParams.get('testTop10Popup') === 'true';

  // Get user's rank
  const userRankData = getUserRank(address);
  const isUserInTop10Real = userRankData && userRankData.rank && userRankData.rank <= 10;
  const isUserInTop10 = devMode || isUserInTop10Real;

  // Show celebration popup when user enters top 10
  useEffect(() => {
    if (testTop10Popup && !isLoading) {
      setShowCelebrationPopup(true);
      return;
    }

    if (!address || isLoading || hasShownCelebration) return;

    const currentRank = userRankData?.rank;

    // User just entered top 10 (wasn't in top 10 before, now is)
    if (currentRank && currentRank <= 10) {
      // Check localStorage to see if we already celebrated for this wallet
      const celebratedKey = `celebrated_top10_${address.toLowerCase()}`;
      const alreadyCelebrated = localStorage.getItem(celebratedKey);

      if (!alreadyCelebrated) {
        setShowCelebrationPopup(true);
        setHasShownCelebration(true);
        localStorage.setItem(celebratedKey, 'true');
      }
    }

    setPreviousRank(currentRank || null);
  }, [userRankData?.rank, address, isLoading, testTop10Popup, hasShownCelebration]);

  // Check if current user is a moderator
  const isModerator = address ? MODERATOR_WALLETS.includes(address.toLowerCase()) : false;

  // Get top 10 bridgers (show 10 in panel now)
  const top10Bridgers = allBridgersRanked.slice(0, 10);

  // Get top 10 wallet addresses for highlighting
  const top10Wallets = new Set(
    allBridgersRanked.slice(0, 10).map(b => b.wallet_address.toLowerCase())
  );

  // Filter out $0 transactions and take first 5
  const filteredTransactions = transactions
    .filter(tx => tx.amount_usd > 0.01)
    .slice(0, 5);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleEditMessage = () => {
    const currentMsg = address ? getMessage(address) : null;
    setEditingMessage(currentMsg);
    setShowMessagePopup(true);
  };

  const handleSaveMessage = async (message: string): Promise<boolean> => {
    if (!address) return false;
    return await saveMessage(address, message);
  };

  const handleDeleteMessage = async (): Promise<boolean> => {
    if (!address) return false;
    return await deleteMessage(address);
  };

  // Moderator can delete any message
  const handleModeratorDelete = async (walletAddress: string) => {
    if (!isModerator) return;
    if (confirm(`Delete message from ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}?`)) {
      await deleteMessage(walletAddress);
    }
  };

  if (isLoading && transactions.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <h3 className="font-semibold text-sm">Live Activity</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm relative overflow-hidden">
      {/* Header with stats inline */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="w-4 h-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          </div>
          <h3 className="font-semibold text-sm">Live Activity</h3>
          {(stats.totalVolume24h > 0 || stats.transactionCount24h > 0) && (
            <span className="text-xs text-muted-foreground">
              • {formatAmount(stats.totalVolume24h)} • {stats.transactionCount24h} bridges
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTop(!showTop)}
            className={`p-1 rounded-lg hover:bg-white/10 transition-colors ${showTop ? 'bg-yellow-500/20 text-yellow-500' : ''}`}
            title="Top Bridgers"
          >
            <Trophy className={`w-3.5 h-3.5 ${!showTop ? 'text-yellow-500 animate-pulse' : ''}`} />
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top 10 Bridgers Panel */}
      {showTop && (
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-yellow-500">Top 10 Bridgers (24h)</span>
            <button onClick={() => setShowTop(false)} className="p-0.5 hover:bg-white/10 rounded">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-1.5">
            {top10Bridgers.map((bridger, index) => {
              const isCurrentUser = address?.toLowerCase() === bridger.wallet_address.toLowerCase();
              const walletMessage = getMessage(bridger.wallet_address);

              return (
                <div key={bridger.wallet_address} className={`flex items-center gap-2 text-xs ${isCurrentUser ? 'bg-primary/10 rounded px-1 -mx-1' : ''}`}>
                  <span className={`w-4 text-center font-medium ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {index + 1}
                  </span>
                  <span className={`font-mono shrink-0 ${isCurrentUser ? 'text-primary font-semibold' : 'text-foreground/70'}`}>
                    {isCurrentUser ? 'You' : formatAddress(bridger.wallet_address)}
                  </span>
                  {/* Message - highlighted for top 3 */}
                  {walletMessage && (
                    <span
                      className={`flex-1 truncate italic ${index < 3 ? 'text-yellow-500/90 font-medium' : 'text-muted-foreground'}`}
                      title={walletMessage}
                    >
                      "{walletMessage}"
                    </span>
                  )}
                  {/* Edit button for current user */}
                  {isCurrentUser && (
                    <button
                      onClick={handleEditMessage}
                      className="p-0.5 hover:bg-white/10 rounded shrink-0"
                      title={walletMessage ? 'Edit message' : 'Add message'}
                    >
                      {walletMessage ? <Edit3 className="w-3 h-3 text-primary" /> : <MessageSquare className="w-3 h-3 text-primary" />}
                    </button>
                  )}
                  {/* Moderator delete button */}
                  {isModerator && walletMessage && !isCurrentUser && (
                    <button
                      onClick={() => handleModeratorDelete(bridger.wallet_address)}
                      className="p-0.5 hover:bg-red-500/20 rounded shrink-0"
                      title="Delete message (moderator)"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  )}
                  <span className="ml-auto shrink-0">{formatAmount(bridger.total_volume)} {getTierBadge(bridger.total_volume)}</span>
                </div>
              );
            })}

            {/* Show user's rank if not in top 10 but has rank data */}
            {userRankData && !isUserInTop10Real && !devMode && (
              <>
                <div className="text-center text-muted-foreground/50 text-[10px]">• • •</div>
                <div className="flex items-center gap-2 text-xs bg-primary/10 rounded px-1 -mx-1">
                  <span className="w-4 text-center font-medium text-muted-foreground">
                    {userRankData.rank}
                  </span>
                  <span className="font-mono text-primary font-semibold">You</span>
                  <span className="ml-auto">{formatAmount(userRankData.total_volume)} {getTierBadge(userRankData.total_volume)}</span>
                </div>
              </>
            )}

            {/* Dev mode indicator */}
            {devMode && !isUserInTop10Real && address && (
              <>
                <div className="text-center text-muted-foreground/50 text-[10px]">• • •</div>
                <div className="flex items-center gap-2 text-xs bg-green-500/10 border border-green-500/20 rounded px-1 -mx-1">
                  <span className="w-4 text-center font-medium text-green-500">
                    🧪
                  </span>
                  <span className="font-mono text-green-500 font-semibold">You (Dev Mode)</span>
                  {getMessage(address) && (
                    <span className="flex-1 truncate text-muted-foreground italic">
                      "{getMessage(address)}"
                    </span>
                  )}
                  <button
                    onClick={handleEditMessage}
                    className="p-0.5 hover:bg-white/10 rounded shrink-0"
                    title="Add/Edit message"
                  >
                    <Edit3 className="w-3 h-3 text-green-500" />
                  </button>
                  <span className="ml-auto shrink-0">$0 🦐</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Transactions */}
      {filteredTransactions.length > 0 ? (
        <div className="space-y-1">
          {filteredTransactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              isTop10={top10Wallets.has(tx.wallet_address.toLowerCase())}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">No recent bridge activity</p>
        </div>
      )}

      {/* Message Input Popup */}
      <MessageInputPopup
        isOpen={showMessagePopup}
        onClose={() => setShowMessagePopup(false)}
        onSave={handleSaveMessage}
        onDelete={handleDeleteMessage}
        currentMessage={editingMessage}
        maxLength={MAX_MESSAGE_LENGTH}
        isSaving={isSaving}
      />

      {/* Top 10 Celebration Popup with Confetti */}
      <Top10CelebrationPopup
        isOpen={showCelebrationPopup}
        onClose={() => setShowCelebrationPopup(false)}
        rank={userRankData?.rank || 1}
        onAddMessage={handleEditMessage}
      />
    </div>
  );
};
