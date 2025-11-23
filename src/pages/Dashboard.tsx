import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Info, ArrowLeft, ArrowRightLeft, Loader2, CheckCircle2, XCircle, X, Vault, Shield, Trophy, Clock, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount, usePublicClient, useReadContracts, useSwitchChain } from "wagmi";
import { USYC_ALLOWLIST, TOKEN_ADDRESSES, TOKEN_DECIMALS, TREASURY_CONTRACTS } from "@/lib/constants";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTreasuryVault } from "@/hooks/useTreasuryVault";
import { useToast } from "@/hooks/use-toast";
import { parseUnits, formatUnits, createPublicClient, http, fallback } from "viem";
import { arcTestnet } from "@/lib/wagmi";
import { DepositModalContent } from "@/components/DepositModalContent";
import { WithdrawModalContent } from "@/components/WithdrawModalContent";
import { PointsDisplay } from "@/components/PointsDisplay";
import { USYCOraclePanel } from "@/components/USYCOraclePanel";
import arcLogo from "@/assets/arc-logo.png";

const Dashboard = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const chainId = account?.chainId;
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [lastConfirmedTxHash, setLastConfirmedTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [manuallyConfirmedTxHash, setManuallyConfirmedTxHash] = useState<`0x${string}` | undefined>(undefined);
  // Get publicClient for Arc Testnet specifically
  const publicClient = usePublicClient({ chainId: 5042002 });
  const checkTxIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { switchChainAsync } = useSwitchChain();

  // Bridge card visibility state
  // Show if user hasn't closed it, OR if balance is critically low (< 1)
  const [showBridgeCard, setShowBridgeCard] = useState(true);

  const handleCloseBridgeCard = () => {
    // Can only close if not critically low
    if (!isCriticallyLow) {
      setShowBridgeCard(false);
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchChainAsync?.({ chainId: 5042002 }); // Arc Testnet
      toast({
        title: "Network switched",
        description: "Successfully switched to Arc Testnet",
        variant: "default",
      });
    } catch (error: any) {
      console.error('[Dashboard] Network switch error:', error);
      toast({
        title: "Failed to switch network",
        description: error?.message || "Please manually switch to Arc Testnet in your wallet",
        variant: "destructive",
      });
    }
  };

  // Check if connected wallet is allowlisted for USYC
  const isAllowlisted = address ? USYC_ALLOWLIST.includes(address as typeof USYC_ALLOWLIST[number]) : false;

  // Get real balances from Arc Testnet
  const { balance: usdcBalance, isLoading: isLoadingUSDC, refetch: refetchUSDC } = useUSDCBalance('arcTestnet');
  
  // Get EURC balance (if contract address exists and is valid)
  // Note: EURC on Arc Testnet is ERC20 token with 6 decimals
  const eurcAddress = TOKEN_ADDRESSES.arcTestnet.EURC;
  const hasEURCAddress = eurcAddress && eurcAddress !== '0x0000000000000000000000000000000000000000';
  const { balance: eurcBalance, isLoading: isLoadingEURC, error: eurcError } = useTokenBalance({
    tokenAddress: hasEURCAddress ? eurcAddress : '0x0000000000000000000000000000000000000000' as `0x${string}`,
    decimals: TOKEN_DECIMALS.EURC, // 6 decimals for EURC
  });
  
  // Log EURC balance fetch for debugging (suppress 429 errors in console)
  useEffect(() => {
    if (eurcError) {
      // Only log non-429 errors
      if (!eurcError.message?.includes('429') && !eurcError.message?.includes('Rate limited')) {
        console.error('[Dashboard] EURC balance error:', eurcError);
      }
    }
  }, [eurcBalance, isLoadingEURC, eurcError, eurcAddress]);
  
  // Get USYC balance (only if allowlisted and contract address exists)
  const usycAddress = TOKEN_ADDRESSES.arcTestnet.USYC;
  const hasUSYCAddress = isAllowlisted && usycAddress && usycAddress !== '0x0000000000000000000000000000000000000000';
  const { balance: usycBalance, isLoading: isLoadingUSYC } = useTokenBalance({
    tokenAddress: hasUSYCAddress ? usycAddress : '0x0000000000000000000000000000000000000000' as `0x${string}`,
    decimals: TOKEN_DECIMALS.USYC,
  });

  // Parse real balances
  const realUSDCBalance = parseFloat(usdcBalance) || 0;
  const realEURCBalance = hasEURCAddress && eurcBalance
    ? (parseFloat(eurcBalance) || 0)
    : 0; // Show 0 if contract address is not set or balance is not available
  const realUSYCBalance = isAllowlisted && usycAddress !== '0x0000000000000000000000000000000000000000'
    ? (parseFloat(usycBalance) || 0)
    : 0; // Show 0 if not allowlisted or contract address is not set

  // Calculate if balance is critically low (< $1)
  // IMPORTANT: This must be calculated AFTER realUSDCBalance and realEURCBalance are defined
  const isCriticallyLow = useMemo(() => {
    return realUSDCBalance < 1 && realEURCBalance < 1;
  }, [realUSDCBalance, realEURCBalance]);

  // Wallet balances - all real now (memoized to prevent child re-renders)
  const walletBalance = useMemo(() => ({
    usdc: realUSDCBalance,
    eurc: realEURCBalance,
    usyc: realUSYCBalance,
  }), [realUSDCBalance, realEURCBalance, realUSYCBalance]);

  const isLoadingBalances = isLoadingUSDC || isLoadingEURC || isLoadingUSYC;

  // Get real vault data from contract
  const {
    totalPoolValue,
    pricePerShare,
    userShares,
    userShareValue,
    totalUSDC,
    totalEURC,
    totalUSYC,
    eurcPricePerShare,
    userEURCShares,
    userEURCShareValue,
    deposit: depositToVault,
    withdraw: withdrawFromVault,
    isPending: isVaultPending,
    isConfirming: isVaultConfirming,
    isConfirmed: isVaultConfirmed,
    hash: vaultTxHash,
    error: vaultError,
    reset: resetVaultTransaction,
    refetchAll: refetchVault,
    isArcTestnet,
  } = useTreasuryVault();

  const { toast } = useToast();

  // Treasury Vault ABI for getUserPoints
  const TREASURY_VAULT_ABI = [
    {
      inputs: [{ name: 'user', type: 'address' }],
      name: 'getUserPoints',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ name: 'user', type: 'address' }],
      name: 'userInfo',
      outputs: [
        { name: 'firstDepositTime', type: 'uint256' },
        { name: 'lastBalanceUpdate', type: 'uint256' },
        { name: 'balanceAtLastUpdate', type: 'uint256' },
        { name: 'accumulatedPoints', type: 'uint256' },
        { name: 'currentPoints', type: 'uint256' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  // Fetch points data
  const { data: pointsData } = useReadContracts({
    contracts: [
      {
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'getUserPoints',
        args: address ? [address] : undefined,
        chainId: 5042002,
      },
      {
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'userInfo',
        args: address ? [address] : undefined,
        chainId: 5042002,
      },
    ],
    query: {
      enabled: isConnected && isArcTestnet && !!address,
      refetchInterval: 60000, // Auto-refresh every 60 seconds to avoid 429 errors
      staleTime: 0, // Always consider data stale - refetch on mount
      gcTime: 0, // Don't cache data - always fetch fresh
      refetchOnMount: true, // Always refetch on component mount
      refetchOnWindowFocus: true, // Refetch when window regains focus
    },
  });

  const points = pointsData?.[0]?.result as bigint | undefined;
  const userInfo = pointsData?.[1]?.result as [bigint, bigint, bigint, bigint, bigint] | undefined;
  const pointsValue = points ? Number(points) : 0;
  const daysSinceFirstDeposit = userInfo && userInfo[0] > 0
    ? Math.floor((Date.now() / 1000 - Number(userInfo[0])) / 86400)
    : 0;

  // Real vault balances from contract (memoized to prevent child re-renders)
  const vaultBalance = useMemo(() => ({
    usdc: parseFloat(totalUSDC) || 0,
    eurc: parseFloat(totalEURC || '0') || 0,
    usyc: parseFloat(totalUSYC) || 0,
  }), [totalUSDC, totalEURC, totalUSYC]);

  // Show pending notification when transaction is submitted
  useEffect(() => {
    if (isVaultPending && vaultTxHash) {
      toast({
        title: "Transaction submitted",
        description: "Waiting for blockchain confirmation...",
        variant: "default",
      });
    }
  }, [isVaultPending, vaultTxHash, toast]);

  // Show confirming notification
  useEffect(() => {
    if (isVaultConfirming && vaultTxHash) {
      toast({
        title: "Transaction confirming",
        description: "Your transaction is being confirmed on the blockchain.",
        variant: "default",
      });
    }
  }, [isVaultConfirming, vaultTxHash, toast]);

  // Check transaction status manually if useWaitForTransactionReceipt doesn't work
  useEffect(() => {
    if (vaultTxHash && !isVaultConfirmed && !manuallyConfirmedTxHash) {
      // Get publicClient with fallback - use multiple RPC endpoints to avoid rate limiting
      const client = publicClient || createPublicClient({
        chain: arcTestnet,
        transport: fallback([
          http('https://rpc.testnet.arc.network'),
          http('https://rpc.blockdaemon.testnet.arc.network'),
          http('https://rpc.drpc.testnet.arc.network'),
          http('https://rpc.quicknode.testnet.arc.network'),
        ]),
      });

      // Clear any existing interval
      if (checkTxIntervalRef.current) {
        clearInterval(checkTxIntervalRef.current);
      }

      // Check transaction status every 8 seconds (reduced frequency to avoid rate limiting)
      checkTxIntervalRef.current = setInterval(async () => {
        try {
          const receipt = await client.getTransactionReceipt({
            hash: vaultTxHash,
          });

          if (receipt && receipt.status === 'success') {
            // Transaction confirmed!
            setManuallyConfirmedTxHash(vaultTxHash);
            setLastConfirmedTxHash(vaultTxHash);

            // Clear interval
            if (checkTxIntervalRef.current) {
              clearInterval(checkTxIntervalRef.current);
              checkTxIntervalRef.current = null;
            }
          } else if (receipt && receipt.status === 'reverted') {
            // Transaction failed
            if (checkTxIntervalRef.current) {
              clearInterval(checkTxIntervalRef.current);
              checkTxIntervalRef.current = null;
            }
          }
        } catch {
          // Transaction not found yet, continue checking
        }
      }, 8000); // Check every 8 seconds (reduced from 3s)

      // Stop checking after 2 minutes
      setTimeout(() => {
        if (checkTxIntervalRef.current) {
          clearInterval(checkTxIntervalRef.current);
          checkTxIntervalRef.current = null;
        }
      }, 120000);
    }

    return () => {
      if (checkTxIntervalRef.current) {
        clearInterval(checkTxIntervalRef.current);
        checkTxIntervalRef.current = null;
      }
    };
  }, [vaultTxHash, isVaultConfirmed, manuallyConfirmedTxHash, publicClient]);

  // Refetch vault data and wallet balance after successful transaction
  useEffect(() => {
    const isConfirmed = isVaultConfirmed || (vaultTxHash && manuallyConfirmedTxHash === vaultTxHash);

    if (isConfirmed && vaultTxHash) {
      toast({
        title: "Transaction confirmed",
        description: "Your transaction has been confirmed on the blockchain.",
        variant: "default",
      });

      // Store the confirmed transaction hash
      if (vaultTxHash) {
        setLastConfirmedTxHash(vaultTxHash);
      }

      // Close modals after confirmation
      setTimeout(() => {
        setShowDepositModal(false);
        setShowWithdrawModal(false);
      }, 2000); // Wait 2 seconds before closing so user can see the success message

      // Single refetch after delay to ensure blockchain state is updated
      const refetchTimeout = setTimeout(() => {
        refetchVault();
        refetchUSDC();
      }, 8000); // Wait 8 seconds for blockchain state to propagate

      return () => {
        clearTimeout(refetchTimeout);
      };
    }
  }, [isVaultConfirmed, manuallyConfirmedTxHash, vaultTxHash, refetchVault, refetchUSDC, toast]);

  // Show error toast
  useEffect(() => {
    if (vaultError) {
      toast({
        title: "Transaction failed",
        description: vaultError.message || "An error occurred",
        variant: "destructive",
      });
    }
  }, [vaultError, toast]);

  // DEBUG: Log modal and transaction state
  useEffect(() => {
    console.log('[Dashboard] Modal & Transaction State:', {
      showDepositModal,
      showWithdrawModal,
      isVaultPending,
      isVaultConfirming,
      isVaultConfirmed,
      vaultTxHash: vaultTxHash ? `${vaultTxHash.slice(0, 10)}...` : 'none',
      manuallyConfirmedTxHash: manuallyConfirmedTxHash ? `${manuallyConfirmedTxHash.slice(0, 10)}...` : 'none',
      lastConfirmedTxHash: lastConfirmedTxHash ? `${lastConfirmedTxHash.slice(0, 10)}...` : 'none',
    });
  }, [showDepositModal, showWithdrawModal, isVaultPending, isVaultConfirming, isVaultConfirmed, vaultTxHash, manuallyConfirmedTxHash, lastConfirmedTxHash]);

  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/30 sticky top-0 bg-background/80 backdrop-blur-lg z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="hover:bg-card">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <img src={arcLogo} alt="Arc Treasury" className="w-8 h-8" />
              <h1 className="text-2xl font-bold">Treasury Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => navigate("/bridge")} variant="outline" className="border-primary/30 hover:bg-primary/10 font-medium">
                Bridge
              </Button>
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {/* Wrong Network Warning */}
        {!isArcTestnet && isConnected && (
          <div className="max-w-7xl mx-auto mb-8">
            <Card className="p-6 border-red-500/50 bg-red-500/10 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 animate-pulse">
                    <XCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2 text-red-600">⚠️ Wrong Network Detected</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      You're currently on <span className="font-mono font-semibold text-red-600">Chain ID: {chainId}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Arc Treasury only works on <span className="font-semibold text-primary">Arc Testnet (Chain ID: 5042002)</span>.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSwitchNetwork}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg whitespace-nowrap"
                  size="lg"
                >
                  Switch to Arc Testnet
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Bridge Call-to-Action Card - Show when balance is low */}
        {/* Always show if critically low (< 1), or show if not closed by user */}
        {(showBridgeCard || isCriticallyLow) && isArcTestnet && (realUSDCBalance < 10 || realEURCBalance < 10) && (
          <div className="max-w-7xl mx-auto mb-8">
            <Card className={`p-6 bg-gradient-to-r relative animate-in fade-in slide-in-from-top-2 duration-500 ${
              isCriticallyLow
                ? 'border-red-500/50 from-red-500/10 to-orange-500/5'
                : 'border-blue-500/30 from-blue-500/5 to-primary/5'
            }`}>
              {/* Only show close button if balance is not critically low */}
              {!isCriticallyLow && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleCloseBridgeCard}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              <div className={`flex flex-col md:flex-row items-center justify-between gap-6 ${isCriticallyLow ? 'pr-6' : 'pr-8'}`}>
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-lg animate-pulse ${
                    isCriticallyLow
                      ? 'bg-red-500/10 border border-red-500/20'
                      : 'bg-blue-500/10 border border-blue-500/20'
                  }`}>
                    <Info className={`w-6 h-6 ${isCriticallyLow ? 'text-red-500' : 'text-blue-500'}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold mb-2 ${
                      isCriticallyLow ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {isCriticallyLow ? '⚠️ Critical: Need USDC or EURC!' : 'Need USDC or EURC on Arc?'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      You have <span className="font-semibold">${realUSDCBalance.toFixed(2)} USDC</span> and <span className="font-semibold">€{realEURCBalance.toFixed(2)} EURC</span> available.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isCriticallyLow
                        ? 'Your balance is too low to make deposits. Bridge funds immediately to get started.'
                        : 'Bridge from Ethereum Sepolia using Circle CCTP to get started with deposits.'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate("/bridge")}
                  className={`font-semibold whitespace-nowrap shadow-lg ${
                    isCriticallyLow
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  {isCriticallyLow ? 'Bridge Now!' : 'Bridge Now'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-8">
          {/* Main Treasury Vault - Center */}
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Vault className="w-8 h-8 text-primary" />
              <h2 className="text-3xl font-bold text-center">My Treasury Vault</h2>
            </div>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Your secure on-chain savings
            </p>
            {/* Premium Treasury Vault Card - Clean Design */}
            <div className="relative overflow-hidden rounded-2xl">
              {/* Animated border glow effect */}
              <div className="absolute -inset-[2px] bg-gradient-to-r from-primary/50 via-primary to-primary/50 rounded-2xl opacity-75 blur-sm animate-pulse" />

              {/* Card with gradient background */}
              <div className="relative rounded-2xl metallic-gradient border border-primary/30 shadow-2xl overflow-hidden">
                {/* Floating lock icon - top right corner */}
                <div className="absolute top-6 right-6 w-12 h-12 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20 flex items-center justify-center animate-pulse">
                  <Shield className="w-6 h-6 text-primary" />
                </div>

                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/95" />

              {/* Content */}
              <div className="relative z-10 p-8">
                <div className="space-y-5">
                  {/* Deposits Breakdown - Always show USDC and EURC */}
                  <div>
                    <p className="text-xs text-foreground/80 uppercase tracking-wider mb-3 font-semibold">Your Deposits</p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-4 rounded-lg bg-background/70 backdrop-blur-sm border border-border/80 shadow-sm">
                        <span className="text-sm font-medium text-foreground">USDC</span>
                        <span className="text-lg font-semibold text-foreground">
                          ${parseFloat(userShareValue || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-4 rounded-lg bg-background/70 backdrop-blur-sm border border-border/80 shadow-sm">
                        <span className="text-sm font-medium text-foreground">EURC</span>
                        <span className="text-lg font-semibold text-foreground">
                          €{parseFloat(userEURCShareValue || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Value */}
                  <div className="pt-6 border-t border-primary/30">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-foreground/80">Current Value</span>
                      <span className="text-3xl font-bold text-primary drop-shadow-lg">
                        ${(parseFloat(userShareValue || '0') + parseFloat(userEURCShareValue || '0')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/70 text-right">
                      Including simulated yield from USYC
                    </p>
                  </div>
                </div>

                {/* Action Buttons - Deposit and Withdraw */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => setShowDepositModal(true)}
                    className="bg-primary hover:bg-primary/90 font-medium"
                    size="lg"
                  >
                    Deposit
                  </Button>
                  <Button
                    onClick={() => setShowWithdrawModal(true)}
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10 font-medium bg-background/50 backdrop-blur-sm"
                    size="lg"
                  >
                    Withdraw
                  </Button>
                </div>

                {/* Info Note */}
                <div className="mt-6 pt-6 border-t border-border/40">
                  <p className="text-xs text-foreground/70 text-center font-light leading-relaxed">
                    Withdraw anytime. Simulated yield updates based on USYC oracle price.
                  </p>
                </div>
              </div>

                {/* Glow accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              </div>
            </div>
          </div>

          {/* Bottom Grid: Wallet + Points + Oracle */}
          <div className="grid lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {/* My Wallet - Information Only */}
            <Card className="p-6 space-y-4 border-border/50">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                My Wallet
              </h3>
              <div>
                <p className="text-xs text-muted-foreground mb-3">Available Balance</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-background/60">
                    <span className="text-sm font-medium">USDC</span>
                    <span className="font-semibold text-sm">
                      {isLoadingUSDC ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        `$${walletBalance.usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-background/60">
                    <span className="text-sm font-medium">EURC</span>
                    <span className="font-semibold text-sm">
                      {isLoadingEURC ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        `€${walletBalance.eurc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      )}
                    </span>
                  </div>
                </div>

                {/* Low balance hint */}
                {!isLoadingUSDC && !isLoadingEURC && (realUSDCBalance < 10 || realEURCBalance < 10) && (
                  <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Info className="w-3 h-3 text-blue-500" />
                      Low balance detected
                    </p>
                    <Button
                      onClick={() => navigate("/bridge")}
                      variant="outline"
                      size="sm"
                      className="w-full text-xs border-blue-500/30 hover:bg-blue-500/10 text-blue-600"
                    >
                      <ArrowRightLeft className="w-3 h-3 mr-1" />
                      Bridge Funds
                    </Button>
                  </div>
                )}
              </div>

              {/* Points Section */}
              <div className="pt-4 border-t border-border/30">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Your Points</span>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-bold text-primary">{pointsValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  <span className="text-xs text-muted-foreground">points</span>
                </div>

                {userInfo && userInfo[0] > 0 && (
                  <div className="space-y-1 pt-3 mt-3 border-t border-border/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>Days active: {daysSinceFirstDeposit}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <DollarSign className="w-3 h-3" />
                      <span>
                        Current balance: ${(Number(userInfo[2]) / 1e6).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Points Display */}
            <PointsDisplay />

            {/* USYC Oracle Info */}
            <USYCOraclePanel />
          </div>
        </div>
      </main>

      {/* Deposit Modal */}
      <Dialog
        open={showDepositModal}
        onOpenChange={(open) => {
          setShowDepositModal(open);
          // Reset transaction state when modal is closed
          if (!open) {
            resetVaultTransaction(); // Reset wagmi transaction state
            setLastConfirmedTxHash(undefined);
            setManuallyConfirmedTxHash(undefined);
            if (checkTxIntervalRef.current) {
              clearInterval(checkTxIntervalRef.current);
              checkTxIntervalRef.current = null;
            }
          }
        }}
      >
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Deposit to Treasury Vault</DialogTitle>
            <DialogDescription>
              Deposit USDC or EURC into the treasury vault to earn yield through USYC.
            </DialogDescription>
          </DialogHeader>
          <DepositModalContent
            onClose={() => setShowDepositModal(false)}
            onDeposit={async (amount: string, currency: "USDC" | "EURC") => {
              try {
                if (!isArcTestnet) {
                  toast({
                    title: "Wrong network",
                    description: "Please switch to Arc Testnet to deposit.",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Reset last confirmed tx hash when starting new transaction
                setLastConfirmedTxHash(undefined);
                
                // Show pending notification
                toast({
                  title: "Transaction pending",
                  description: "Please confirm the transaction in your wallet.",
                  variant: "default",
                });
                
                await depositToVault(amount, currency);
                
                // Don't close modal immediately - let it show pending/confirmed state
                // Modal will close when transaction is confirmed (handled in DepositModalContent)
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : "Failed to deposit";
                toast({
                  title: "Deposit failed",
                  description: errorMessage,
                  variant: "destructive",
                });
              }
            }}
            availableBalanceUSDC={walletBalance.usdc}
            availableBalanceEURC={walletBalance.eurc}
            isPending={isVaultPending || isVaultConfirming}
            txHash={vaultTxHash}
            isConfirmed={(isVaultConfirmed || (vaultTxHash && manuallyConfirmedTxHash === vaultTxHash)) && vaultTxHash === lastConfirmedTxHash}
            pricePerShare={pricePerShare}
          />
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog
        open={showWithdrawModal}
        onOpenChange={(open) => {
          setShowWithdrawModal(open);
          // Reset transaction state when modal is closed
          if (!open) {
            resetVaultTransaction(); // Reset wagmi transaction state
            setLastConfirmedTxHash(undefined);
            setManuallyConfirmedTxHash(undefined);
            if (checkTxIntervalRef.current) {
              clearInterval(checkTxIntervalRef.current);
              checkTxIntervalRef.current = null;
            }
          }
        }}
      >
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw from Treasury Vault</DialogTitle>
            <DialogDescription>
              Withdraw your shares from the treasury vault back to USDC or EURC.
            </DialogDescription>
          </DialogHeader>
          <WithdrawModalContent
            onClose={() => setShowWithdrawModal(false)}
            onWithdraw={async (shares: string, currency: "USDC" | "EURC") => {
              try {
                if (!isArcTestnet) {
                  toast({
                    title: "Wrong network",
                    description: "Please switch to Arc Testnet to withdraw.",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Reset last confirmed tx hash when starting new transaction
                setLastConfirmedTxHash(undefined);
                
                await withdrawFromVault(shares, currency);
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : "Failed to withdraw";
                toast({
                  title: "Withdraw failed",
                  description: errorMessage,
                  variant: "destructive",
                });
              }
            }}
            userShares={userShares}
            userShareValue={userShareValue}
            pricePerShare={pricePerShare}
            userEURCShares={userEURCShares}
            userEURCShareValue={userEURCShareValue}
            eurcPricePerShare={eurcPricePerShare}
            isPending={isVaultPending || isVaultConfirming}
            txHash={vaultTxHash}
            isConfirmed={(isVaultConfirmed || (vaultTxHash && manuallyConfirmedTxHash === vaultTxHash)) && vaultTxHash === lastConfirmedTxHash}
          />
        </DialogContent>
      </Dialog>

    </div>;
};

export default Dashboard;