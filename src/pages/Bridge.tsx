import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Info, ArrowLeft, Loader2, ExternalLink, XCircle, ArrowLeftRight, X, CheckCircle2, AlertCircle, Wallet, Clock, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { useBridgeCCTP } from "@/hooks/useBridgeCCTP";
import { useBridgeSolana, EVMNetwork } from "@/hooks/useBridgeSolana";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import { LiveBridgeFeed } from "@/components/LiveBridgeFeed";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

// Solana USDC mint address (Devnet)
const SOLANA_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

const formatBalance = (balance: string) => {
  const num = parseFloat(balance);
  if (isNaN(num)) return balance;
  // Always show 2 decimal places for accurate balance display
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type NetworkType = 'ethereumSepolia' | 'arcTestnet' | 'solanaDevnet';

const NETWORK_OPTIONS: { id: NetworkType; name: string }[] = [
  { id: 'ethereumSepolia', name: 'Ethereum Sepolia' },
  { id: 'arcTestnet', name: 'Arc Testnet' },
  { id: 'solanaDevnet', name: 'Solana Devnet' },
];

const Bridge = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const isConnected = account?.isConnected ?? false;

  // Unified network selection
  const [fromNetwork, setFromNetwork] = useState<NetworkType>('ethereumSepolia');
  const [toNetwork, setToNetwork] = useState<NetworkType>('arcTestnet');
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const fromDropdownRef = useRef<HTMLDivElement>(null);
  const toDropdownRef = useRef<HTMLDivElement>(null);

  const [amount, setAmount] = useState<string>("");
  const [showFaucetInfo, setShowFaucetInfo] = useState(() => {
    return localStorage.getItem('bridge_faucet_dismissed') !== 'true';
  });
  const [showBadgeReminder, setShowBadgeReminder] = useState(() => {
    return localStorage.getItem('bridge_badge_dismissed') !== 'true';
  });
  const [savedBridgeParams, setSavedBridgeParams] = useState<{ amount: string; toNetwork: NetworkType } | null>(null);
  const [showRestoreForm, setShowRestoreForm] = useState(false);
  const [restoreTxHash, setRestoreTxHash] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error' | 'claimed'; message: string }>({ type: 'idle', message: '' });

  // Solana balance state
  const [solanaBalance, setSolanaBalance] = useState<string | null>(null);
  const [solanaRefreshKey, setSolanaRefreshKey] = useState(0);

  // Determine if Solana is involved
  const isSolanaInvolved = fromNetwork === 'solanaDevnet' || toNetwork === 'solanaDevnet';
  const isEVMtoEVM = !isSolanaInvolved;

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fromDropdownRef.current && !fromDropdownRef.current.contains(event.target as Node)) {
        setShowFromDropdown(false);
      }
      if (toDropdownRef.current && !toDropdownRef.current.contains(event.target as Node)) {
        setShowToDropdown(false);
      }
    };
    if (showFromDropdown || showToDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFromDropdown, showToDropdown]);

  // Solana wallet
  const { connected: solanaConnected, publicKey, disconnect: disconnectSolana, connecting: solanaConnecting, wallets, select, connect } = useWallet();
  const { connection } = useConnection();

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleConnectSolana = useCallback(async () => {
    const phantomWallet = wallets.find(w => w.adapter.name === 'Phantom');
    if (phantomWallet) {
      select(phantomWallet.adapter.name);
      try {
        await connect();
      } catch (error) {
        console.error('Failed to connect Phantom:', error);
      }
    }
  }, [wallets, select, connect]);

  // Fetch Solana USDC balance
  const refetchSolanaBalance = useCallback(() => {
    setSolanaRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    const fetchSolanaBalance = async () => {
      if (!publicKey || !connection) {
        setSolanaBalance(null);
        return;
      }
      try {
        const ata = await getAssociatedTokenAddress(SOLANA_USDC_MINT, publicKey);
        const balance = await connection.getTokenAccountBalance(ata);
        setSolanaBalance(balance.value.uiAmountString || '0');
      } catch {
        setSolanaBalance('0');
      }
    };
    fetchSolanaBalance();
  }, [publicKey, connection, solanaRefreshKey]);

  // Bridge hooks
  const {
    state: solanaState,
    bridgeToSolana,
    bridgeFromSolana,
    reset: resetSolana,
  } = useBridgeSolana();

  const { bridge, claimPendingBridge, clearPendingBurn, restorePendingBurn, reset: resetCCTP, isBridging, isClaiming, error, result, transactions, attestationStatus, mintConfirmed, pendingBurn } = useBridgeCCTP();

  // Get balances
  const { balance: sepoliaBalance, isLoading: isLoadingSepolia, refetch: refetchSepolia } = useUSDCBalance('ethereumSepolia');
  const { balance: arcBalance, isLoading: isLoadingArc, refetch: refetchArc } = useUSDCBalance('arcTestnet');

  // Get current source balance based on fromNetwork
  const getSourceBalance = () => {
    if (fromNetwork === 'ethereumSepolia') return sepoliaBalance;
    if (fromNetwork === 'arcTestnet') return arcBalance;
    if (fromNetwork === 'solanaDevnet') return solanaBalance || '0';
    return '0';
  };

  const getDestBalance = () => {
    if (toNetwork === 'ethereumSepolia') return sepoliaBalance;
    if (toNetwork === 'arcTestnet') return arcBalance;
    if (toNetwork === 'solanaDevnet') return solanaBalance || '0';
    return '0';
  };

  const sourceBalance = getSourceBalance();
  const destBalance = getDestBalance();
  const isLoadingBalance = (fromNetwork === 'ethereumSepolia' && isLoadingSepolia) ||
                           (fromNetwork === 'arcTestnet' && isLoadingArc);

  // Persist dismissal to localStorage
  useEffect(() => {
    if (!showFaucetInfo) {
      localStorage.setItem('bridge_faucet_dismissed', 'true');
    }
  }, [showFaucetInfo]);

  useEffect(() => {
    if (!showBadgeReminder) {
      localStorage.setItem('bridge_badge_dismissed', 'true');
    }
  }, [showBadgeReminder]);

  // Handle bridge based on networks
  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSavedBridgeParams({ amount, toNetwork });

    if (isEVMtoEVM) {
      // EVM to EVM bridge
      await bridge({
        fromNetwork: fromNetwork as 'ethereumSepolia' | 'arcTestnet',
        toNetwork: toNetwork as 'ethereumSepolia' | 'arcTestnet',
        amount
      });
    } else if (fromNetwork === 'solanaDevnet') {
      // Solana to EVM
      await bridgeFromSolana(toNetwork as EVMNetwork, amount);
    } else if (toNetwork === 'solanaDevnet') {
      // EVM to Solana
      await bridgeToSolana(fromNetwork as EVMNetwork, amount);
    }
  };

  const handleMax = () => {
    // Use exact balance string to send full amount
    if (parseFloat(sourceBalance) > 0) setAmount(sourceBalance);
  };

  const handleHalf = () => {
    const balance = parseFloat(sourceBalance);
    // Floor to 6 decimals (USDC precision)
    if (balance > 0) setAmount((Math.floor((balance / 2) * 1000000) / 1000000).toString());
  };

  const handleSwapNetworks = () => {
    const temp = fromNetwork;
    setFromNetwork(toNetwork);
    setToNetwork(temp);
    setAmount("");
  };

  const selectFromNetwork = (network: NetworkType) => {
    if (network === toNetwork) {
      // Swap if same
      setToNetwork(fromNetwork);
    }
    setFromNetwork(network);
    setShowFromDropdown(false);
    setAmount("");
  };

  const selectToNetwork = (network: NetworkType) => {
    if (network === fromNetwork) {
      // Swap if same
      setFromNetwork(toNetwork);
    }
    setToNetwork(network);
    setShowToDropdown(false);
  };

  const handleRestore = async () => {
    if (!restoreTxHash || !restoreTxHash.startsWith('0x')) return;
    if (restoreTxHash.length !== 66) {
      setRestoreStatus({ type: 'error', message: 'Transaction hash should be 66 characters (0x + 64 hex)' });
      return;
    }
    setRestoreStatus({ type: 'loading', message: 'Verifying with Circle API...' });
    const fromNet = fromNetwork as 'ethereumSepolia' | 'arcTestnet';
    const toNet = toNetwork as 'ethereumSepolia' | 'arcTestnet';
    const result = await restorePendingBurn(restoreTxHash, fromNet, toNet, '0');
    if (result.success) {
      setRestoreStatus({ type: 'success', message: result.message });
      setTimeout(() => {
        setShowRestoreForm(false);
        setRestoreTxHash("");
        setRestoreStatus({ type: 'idle', message: '' });
      }, 2000);
    } else {
      setRestoreStatus({ type: result.type as 'error' | 'claimed', message: result.message });
    }
  };

  // Determine current bridging state
  const currentIsBridging = isSolanaInvolved ? solanaState.isBridging : isBridging;
  const currentError = isSolanaInvolved ? solanaState.error : error;
  const currentAttestationStatus = isSolanaInvolved ? solanaState.attestationStatus : attestationStatus;
  const isComplete = currentAttestationStatus === 'complete';

  // Auto-refresh balances when bridge completes (silent to avoid UI flicker)
  useEffect(() => {
    if (isComplete) {
      // Delay slightly to allow blockchain state to update
      const timer = setTimeout(() => {
        refetchSepolia(true); // silent refetch
        refetchArc(true); // silent refetch
        refetchSolanaBalance(); // refetch Solana balance
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, refetchSepolia, refetchArc, refetchSolanaBalance]);

  // Get gas hint text
  const getGasHint = () => {
    if (fromNetwork === 'ethereumSepolia') return 'ETH on Sepolia';
    if (fromNetwork === 'arcTestnet') return 'USDC on Arc Testnet';
    if (fromNetwork === 'solanaDevnet') return 'SOL on Solana';
    return '';
  };

  const getNetworkName = (network: NetworkType) => {
    return NETWORK_OPTIONS.find(n => n.id === network)?.name || network;
  };

  // Check if ready to bridge
  const canBridge = () => {
    if (!amount || parseFloat(amount) <= 0) return false;
    if (currentIsBridging) return false;

    // Need EVM wallet for EVM networks
    if (fromNetwork !== 'solanaDevnet' && !isConnected) return false;

    // Need Solana wallet for Solana
    if (isSolanaInvolved && !solanaConnected) return false;

    return true;
  };

  const getButtonText = () => {
    if (currentIsBridging) return 'Bridging...';
    if (!isConnected && fromNetwork !== 'solanaDevnet') return 'Connect EVM Wallet';
    if (isSolanaInvolved && !solanaConnected) return 'Connect Solana Wallet';
    return `Bridge to ${getNetworkName(toNetwork)}`;
  };

  const handleReset = () => {
    if (isSolanaInvolved) {
      resetSolana();
    }
    // Reset EVM bridge state
    resetCCTP();
    setSavedBridgeParams(null);
    setAmount("");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/5 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/20 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm" className="gap-2 hover:bg-white/5">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="h-4 w-px bg-border/30" />
              <h1 className="text-lg font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Bridge</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Solana wallet button - show when Solana is involved */}
              {isSolanaInvolved && (
                solanaConnected && publicKey ? (
                  <Button
                    onClick={() => disconnectSolana()}
                    variant="outline"
                    className="gap-2 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-sm"
                  >
                    <Wallet className="w-4 h-4" />
                    {formatAddress(publicKey.toBase58())}
                  </Button>
                ) : (
                  <Button
                    onClick={handleConnectSolana}
                    disabled={solanaConnecting}
                    variant="outline"
                    className="gap-2 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-sm"
                  >
                    <Wallet className="w-4 h-4" />
                    {solanaConnecting ? '...' : 'Solana'}
                  </Button>
                )
              )}
              {isConnected ? <UserMenu /> : <WalletConnect />}
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 container mx-auto px-6 max-w-2xl">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 mb-4">
            <ArrowLeftRight className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Bridge USDC</h2>
          <p className="text-sm text-muted-foreground">
            Sepolia ↔ Arc Testnet ↔ Solana Devnet via Circle CCTP
          </p>
        </div>

        {/* Info Cards */}
        {(showFaucetInfo || showBadgeReminder) && (
          <div className="mb-6 space-y-3">
            {/* Faucet Info */}
            {showFaucetInfo && (
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 backdrop-blur-sm relative">
                <button
                  onClick={() => setShowFaucetInfo(false)}
                  className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="flex items-start gap-3 pr-6">
                  <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Need testnet tokens?</p>
                    <div className="space-y-1">
                      {isSolanaInvolved ? (
                        <a
                          href="https://faucet.solana.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-purple-400 hover:underline flex items-center gap-1"
                        >
                          Solana Faucet (SOL for gas)
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <a
                          href="https://faucet.circle.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Circle Faucet (USDC for EVM)
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Early Badge Reminder */}
            {showBadgeReminder && (
              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 backdrop-blur-sm relative">
                <button
                  onClick={() => setShowBadgeReminder(false)}
                  className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="flex items-start gap-3 pr-6">
                  <span className="text-xl">🏆</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Don't forget your Early Badge!</p>
                    <button
                      onClick={() => navigate("/rewards")}
                      className="text-sm text-purple-400 hover:underline inline-flex items-center gap-1"
                    >
                      Mint free Early Supporter NFT
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unified Bridge Form */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm space-y-6">
          {/* From Network */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">From</p>
            <div className="relative" ref={fromDropdownRef}>
              <button
                onClick={() => !currentIsBridging && setShowFromDropdown(!showFromDropdown)}
                disabled={currentIsBridging}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getNetworkName(fromNetwork)}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showFromDropdown ? 'rotate-180' : ''}`} />
                </div>
                <span className="text-sm text-muted-foreground">
                  {isLoadingBalance ? '...' : `${formatBalance(sourceBalance)} USDC`}
                </span>
              </button>
              {showFromDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-background border border-white/10 shadow-2xl overflow-hidden z-10">
                  {NETWORK_OPTIONS.map((network) => (
                    <button
                      key={network.id}
                      onClick={() => selectFromNetwork(network.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors group ${fromNetwork === network.id ? 'bg-primary/10' : ''}`}
                    >
                      <span className={`text-sm transition-colors ${fromNetwork === network.id ? 'text-primary font-medium' : 'group-hover:text-primary'}`}>
                        {network.name}
                      </span>
                      {fromNetwork === network.id && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Arrow - clickable to swap */}
          <div className="flex justify-center">
            <button
              onClick={handleSwapNetworks}
              disabled={currentIsBridging}
              className="p-3 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Swap networks"
            >
              <ArrowLeftRight className="w-5 h-5 text-primary" />
            </button>
          </div>

          {/* To Network */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">To</p>
            <div className="relative" ref={toDropdownRef}>
              <button
                onClick={() => !currentIsBridging && setShowToDropdown(!showToDropdown)}
                disabled={currentIsBridging}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getNetworkName(toNetwork)}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showToDropdown ? 'rotate-180' : ''}`} />
                </div>
                <span className="text-sm text-muted-foreground">
                  {`${formatBalance(destBalance)} USDC`}
                </span>
              </button>
              {showToDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-background border border-white/10 shadow-2xl overflow-hidden z-10">
                  {NETWORK_OPTIONS.map((network) => (
                    <button
                      key={network.id}
                      onClick={() => selectToNetwork(network.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors group ${toNetwork === network.id ? 'bg-primary/10' : ''}`}
                    >
                      <span className={`text-sm transition-colors ${toNetwork === network.id ? 'text-primary font-medium' : 'group-hover:text-primary'}`}>
                        {network.name}
                      </span>
                      {toNetwork === network.id && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Amount</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleHalf}
                  disabled={currentIsBridging || parseFloat(sourceBalance) <= 0}
                  className="h-7 text-xs rounded-lg"
                >
                  HALF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMax}
                  disabled={currentIsBridging || parseFloat(sourceBalance) <= 0}
                  className="h-7 text-xs rounded-lg"
                >
                  MAX
                </Button>
              </div>
            </div>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
              className="text-lg font-mono rounded-xl h-14 bg-white/5 border-white/10"
              min="0"
              step="0.01"
              disabled={currentIsBridging}
            />
            <p className="text-xs text-muted-foreground">
              Available: {isLoadingBalance ? '...' : `${formatBalance(sourceBalance)} USDC`}
            </p>
          </div>

          {/* Error */}
          {currentError && currentAttestationStatus === 'idle' && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{currentError}</p>
            </div>
          )}

          {/* EVM Bridge Status Messages */}
          {isEVMtoEVM && (
            <>
              {/* Attestation Status - Pending */}
              {attestationStatus === 'pending' && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-400 animate-pulse flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-400 mb-1">
                        Waiting for Circle Attestation
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This usually takes under 30 seconds...
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Attestation received, waiting for mint */}
              {attestationStatus === 'attested' && (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-start gap-3">
                    <Loader2 className="w-5 h-5 text-yellow-400 animate-spin flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-400 mb-1">
                        Attestation Received - Minting...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Please confirm the mint transaction in your wallet
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction confirming */}
              {attestationStatus === 'confirming' && (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-start gap-3">
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-purple-400 mb-1">
                        Confirming Transaction...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Waiting for blockchain confirmation
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending mint recovery */}
              {attestationStatus === 'pending_mint' && (
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 relative">
                  <button
                    onClick={clearPendingBurn}
                    className="absolute top-2 right-2 p-1 text-orange-400/60 hover:text-orange-400 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-400 mb-1">
                        Your funds are safe!
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Burn completed but mint was not finished. Your USDC is waiting to be claimed.
                      </p>
                      {pendingBurn && (
                        <>
                          <p className="text-xs text-muted-foreground mt-1">
                            Burn TX: <a href={`${SUPPORTED_NETWORKS[pendingBurn.fromNetwork].explorerUrl}/tx/${pendingBurn.txHash}`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">{pendingBurn.txHash.slice(0, 10)}...{pendingBurn.txHash.slice(-8)}</a>
                          </p>
                          <Button
                            onClick={claimPendingBridge}
                            disabled={isClaiming}
                            className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white"
                          >
                            {isClaiming ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Claiming...
                              </>
                            ) : (
                              <>
                                Claim {pendingBurn.amount && pendingBurn.amount !== '0' ? `${pendingBurn.amount} ` : ''}USDC
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Success indicator */}
          {isComplete && savedBridgeParams && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400 mb-1">
                    Bridge Complete!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your {formatBalance(savedBridgeParams.amount)} USDC has been successfully bridged to {getNetworkName(savedBridgeParams.toNetwork)}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bridge Button */}
          {isComplete ? (
            <Button onClick={handleReset} className="w-full rounded-xl h-14 text-base font-semibold">
              Bridge Again
            </Button>
          ) : (
            <Button
              onClick={handleBridge}
              disabled={!canBridge()}
              className="w-full rounded-xl h-14 text-base font-semibold"
            >
              {currentIsBridging ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  Bridging...
                </>
              ) : (
                <>
                  {getButtonText()}
                  {canBridge() && <ArrowRight className="ml-2 w-5 h-5" />}
                </>
              )}
            </Button>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Make sure you have {getGasHint()} for gas fees
          </p>

          {/* EVM Transactions */}
          {isEVMtoEVM && transactions.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Transactions</p>
              <div className="space-y-2">
                {transactions.map((tx, index) => (
                  <div key={index} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {tx.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                          {tx.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                          {tx.status === 'pending' && <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />}
                          <span className="text-sm font-medium">{tx.step}</span>
                          <span className="text-xs text-muted-foreground">({tx.network})</span>
                        </div>
                        {tx.hash && (
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                          </p>
                        )}
                      </div>
                      {tx.explorerUrl && (
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-sm"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Restore Pending Bridge - only for EVM↔EVM */}
          {isEVMtoEVM && (
            <div className="pt-4 border-t border-white/5">
              <button
                onClick={() => setShowRestoreForm(!showRestoreForm)}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center gap-1 mx-auto"
              >
                {showRestoreForm ? <X className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {showRestoreForm ? "Close" : "Having trouble with a stuck transfer?"}
              </button>

              {showRestoreForm && (
                <div className="mt-4 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    If your bridge was interrupted after the burn transaction, enter your burn tx hash to restore and claim.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="0x..."
                      value={restoreTxHash}
                      onChange={(e) => {
                        setRestoreTxHash(e.target.value);
                        if (restoreStatus.type !== 'idle' && restoreStatus.type !== 'loading') {
                          setRestoreStatus({ type: 'idle', message: '' });
                        }
                      }}
                      className="text-sm font-mono h-9 bg-white/5 border-white/10 flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleRestore}
                      disabled={!restoreTxHash || !restoreTxHash.startsWith('0x') || restoreStatus.type === 'loading'}
                      className="bg-yellow-600 hover:bg-yellow-700 h-9"
                    >
                      {restoreStatus.type === 'loading' ? 'Checking...' : 'Restore'}
                    </Button>
                  </div>
                  {restoreStatus.type !== 'idle' && restoreStatus.type !== 'loading' && (
                    <div className={`text-xs mt-2 px-2 py-1.5 rounded-lg ${
                      restoreStatus.type === 'success' ? 'bg-green-500/10 text-green-400' :
                      restoreStatus.type === 'claimed' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {restoreStatus.type === 'success' && '✓ '}
                      {restoreStatus.type === 'claimed' && '✓ '}
                      {restoreStatus.type === 'error' && '✗ '}
                      {restoreStatus.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Activity Feed */}
        <div className="mt-6">
          <LiveBridgeFeed />
        </div>
      </div>
    </div>
  );
};

export default Bridge;
