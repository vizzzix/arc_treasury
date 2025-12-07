import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useAccount } from 'wagmi';
import { ArrowRightLeft, Loader2, CheckCircle2, AlertCircle, ExternalLink, Wallet, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletConnect } from '@/components/WalletConnect';
import { useBridgeSolana, EVMNetwork } from '@/hooks/useBridgeSolana';
import { useUSDCBalance } from '@/hooks/useUSDCBalance';
import { SUPPORTED_NETWORKS } from '@/lib/constants';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

type NetworkType = 'ethereumSepolia' | 'arcTestnet' | 'solanaDevnet';
type Direction = 'to_solana' | 'from_solana';

// Solana USDC mint address (Devnet)
const SOLANA_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

const BridgeSolana = () => {
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>('to_solana');
  const [evmNetwork, setEvmNetwork] = useState<EVMNetwork>('ethereumSepolia');
  const [solanaBalance, setSolanaBalance] = useState<string | null>(null);

  const { connected: solanaConnected, publicKey, disconnect: disconnectSolana, connecting: solanaConnecting, wallets, select, connect } = useWallet();
  const { connection } = useConnection();
  const { isConnected: evmConnected, address: evmAddress } = useAccount();

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleConnectSolana = useCallback(async () => {
    // Find Phantom wallet
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

  // Get EVM USDC balance using our custom hook
  const { balance: sepoliaBalance } = useUSDCBalance('ethereumSepolia');
  const { balance: arcBalance } = useUSDCBalance('arcTestnet');

  const evmBalance = evmNetwork === 'arcTestnet' ? arcBalance : sepoliaBalance;

  // Fetch Solana USDC balance
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
  }, [publicKey, connection]);

  // Get current source balance
  const sourceBalance = direction === 'to_solana'
    ? evmBalance || '0'
    : solanaBalance || '0';

  const {
    state,
    bridgeToSolana,
    bridgeFromSolana,
    reset,
  } = useBridgeSolana();

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    if (direction === 'to_solana') {
      await bridgeToSolana(evmNetwork, amount);
    } else {
      await bridgeFromSolana(evmNetwork, amount);
    }
  };

  const toggleDirection = () => {
    setDirection(prev => prev === 'to_solana' ? 'from_solana' : 'to_solana');
  };

  const sourceNetwork = direction === 'to_solana'
    ? SUPPORTED_NETWORKS[evmNetwork].name
    : SUPPORTED_NETWORKS.solanaDevnet.name;

  const destNetwork = direction === 'to_solana'
    ? SUPPORTED_NETWORKS.solanaDevnet.name
    : SUPPORTED_NETWORKS[evmNetwork].name;

  const isReady = solanaConnected && evmConnected && amount && parseFloat(amount) > 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary">Solana Bridge</h1>
          <p className="text-muted-foreground">
            Bridge USDC between EVM chains and Solana via Circle CCTP
          </p>
        </div>

        {/* Wallet Connection Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* EVM Wallet */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">EVM Wallet</CardTitle>
              <CardDescription className="text-xs">
                {evmConnected ? `${evmAddress?.slice(0, 6)}...${evmAddress?.slice(-4)}` : 'Not connected'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WalletConnect />
            </CardContent>
          </Card>

          {/* Solana Wallet */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Solana Wallet</CardTitle>
              <CardDescription className="text-xs">
                {solanaConnected ? `${publicKey?.toBase58().slice(0, 6)}...${publicKey?.toBase58().slice(-4)}` : 'Not connected'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {solanaConnected && publicKey ? (
                <Button
                  onClick={() => disconnectSolana()}
                  variant="outline"
                  className="border-primary/30 hover:bg-primary/10 font-medium"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  {formatAddress(publicKey.toBase58())}
                  <LogOut className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleConnectSolana}
                  disabled={solanaConnecting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-glow hover:shadow-glow-lg transition-all"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  {solanaConnecting ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bridge Card */}
        <Card>
          <CardHeader>
            <CardTitle>Bridge USDC</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Direction */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">From</p>
                <p className="font-medium">{sourceNetwork}</p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDirection}
                disabled={state.isBridging}
              >
                <ArrowRightLeft className="w-5 h-5" />
              </Button>

              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">To</p>
                <p className="font-medium">{destNetwork}</p>
              </div>
            </div>

            {/* EVM Network Selector */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">EVM Network</label>
              <div className="flex gap-2">
                <Button
                  variant={evmNetwork === 'ethereumSepolia' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEvmNetwork('ethereumSepolia')}
                  disabled={state.isBridging}
                >
                  Ethereum Sepolia
                </Button>
                <Button
                  variant={evmNetwork === 'arcTestnet' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEvmNetwork('arcTestnet')}
                  disabled={state.isBridging}
                >
                  Arc Testnet
                </Button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm text-muted-foreground">Amount (USDC)</label>
                <span className="text-xs text-muted-foreground">
                  Balance: <span className="text-foreground font-medium">{parseFloat(sourceBalance).toFixed(2)} USDC</span>
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={state.isBridging}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount((parseFloat(sourceBalance) / 2).toString())}
                  disabled={state.isBridging || parseFloat(sourceBalance) <= 0}
                >
                  HALF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(sourceBalance)}
                  disabled={state.isBridging || parseFloat(sourceBalance) <= 0}
                >
                  MAX
                </Button>
              </div>
            </div>

            {/* Status */}
            {state.attestationStatus !== 'idle' && (
              <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                {/* Progress Bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${state.attestationProgress}%` }}
                  />
                </div>

                {/* Status Text */}
                <div className="flex items-center gap-2">
                  {state.attestationStatus === 'complete' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : state.error ? (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  )}
                  <span className="text-sm">
                    {state.attestationStatus === 'approval' && 'Approving USDC...'}
                    {state.attestationStatus === 'burn' && 'Burning USDC on source chain...'}
                    {state.attestationStatus === 'attestation_pending' && 'Waiting for Circle attestation (~30s)...'}
                    {state.attestationStatus === 'mint' && 'Minting USDC on destination...'}
                    {state.attestationStatus === 'complete' && 'Bridge complete!'}
                    {state.error && state.error}
                  </span>
                </div>

                {/* Transactions */}
                {state.transactions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    {state.transactions.map((tx, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {tx.status === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : tx.status === 'failed' ? (
                            <AlertCircle className="w-4 h-4 text-destructive" />
                          ) : (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          {tx.step}
                        </span>
                        {tx.hash && (
                          <a
                            href={tx.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {state.error && state.attestationStatus === 'idle' && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                {state.error}
              </div>
            )}

            {/* Bridge Button */}
            {state.attestationStatus === 'complete' ? (
              <Button onClick={reset} className="w-full">
                Bridge Again
              </Button>
            ) : (
              <Button
                onClick={handleBridge}
                disabled={!isReady || state.isBridging}
                className="w-full"
              >
                {state.isBridging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Bridging...
                  </>
                ) : !solanaConnected ? (
                  'Connect Solana Wallet'
                ) : !evmConnected ? (
                  'Connect EVM Wallet'
                ) : (
                  `Bridge ${amount || '0'} USDC`
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              This bridge uses Circle's CCTP (Cross-Chain Transfer Protocol) to securely transfer USDC between chains.
              Transfers typically take ~30 seconds for attestation.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BridgeSolana;
