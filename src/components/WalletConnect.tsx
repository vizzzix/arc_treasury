import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useCircleWallet } from '@/providers/CircleWalletProvider';
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, X, Smartphone, Monitor, Chrome } from "lucide-react";

const getIsMobile = () =>
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

export const WalletConnect = () => {
  const account = useAccount();
  const externalAddress = account?.address;
  const isExternalConnected = account?.isConnected ?? false;

  const circleWallet = useCircleWallet();

  const [showModal, setShowModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const isMobile = useMemo(getIsMobile, []);

  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Connected state — external wallet
  if (isExternalConnected && externalAddress) {
    return (
      <Button
        onClick={() => disconnect()}
        variant="outline"
        className="border-primary/30 hover:bg-primary/10 font-medium"
      >
        <Wallet className="w-4 h-4 mr-2" />
        {formatAddress(externalAddress)}
        <LogOut className="w-4 h-4 ml-2" />
      </Button>
    );
  }

  // Connected state — Circle wallet
  if (circleWallet.isConnected && circleWallet.address) {
    return (
      <Button
        onClick={() => circleWallet.signOut()}
        variant="outline"
        className="border-primary/30 hover:bg-primary/10 font-medium"
      >
        <Chrome className="w-4 h-4 mr-2" />
        {formatAddress(circleWallet.address)}
        <LogOut className="w-4 h-4 ml-2" />
      </Button>
    );
  }

  const handleConnect = (connectorId: string) => {
    const connector = connectors.find(c => c.id === connectorId);
    if (connector) {
      connect({ connector });
      setShowModal(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      await circleWallet.signInWithGoogle();
    } catch {
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        disabled={isPending || circleWallet.isLoading}
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-glow hover:shadow-glow-lg transition-all"
      >
        <Wallet className="w-4 h-4 mr-2" />
        {isPending || circleWallet.isLoading ? 'Connecting...' : 'Connect'}
      </Button>

      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Connect to Arc Treasury</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Google Login */}
              <button
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <div className="p-2 rounded-lg bg-red-500/20">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M5.27 9.76A7.08 7.08 0 0 1 12 5.48c1.76 0 3.34.61 4.6 1.8L19.7 4.2A11.5 11.5 0 0 0 12 1.24 11.53 11.53 0 0 0 1.17 8.25l4.1 1.51Z"/>
                    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.56 5.56 0 0 1-2.4 3.63l3.86 3a11.36 11.36 0 0 0 3.56-8.87Z"/>
                    <path fill="#FBBC05" d="M5.27 14.24A7.05 7.05 0 0 1 4.89 12c0-.78.14-1.54.38-2.24L1.17 8.25A11.56 11.56 0 0 0 0 12c0 1.88.44 3.65 1.17 5.25l4.1-2.01Z"/>
                    <path fill="#34A853" d="M12 23.26c3.16 0 5.82-1.05 7.76-2.85l-3.86-3a6.82 6.82 0 0 1-3.9 1.13 7.07 7.07 0 0 1-6.73-4.9L1.17 15.25A11.53 11.53 0 0 0 12 23.26Z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-medium">Continue with Google</p>
                  <p className="text-xs text-muted-foreground">No wallet needed</p>
                </div>
              </button>

              {/* Wallet — adaptive: Browser on desktop, WalletConnect on mobile */}
              <button
                onClick={() => handleConnect(isMobile ? 'walletConnect' : 'injected')}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <div className={`p-2 rounded-lg ${isMobile ? 'bg-blue-500/20' : 'bg-orange-500/20'}`}>
                  {isMobile
                    ? <Smartphone className="w-5 h-5 text-blue-400" />
                    : <Monitor className="w-5 h-5 text-orange-400" />
                  }
                </div>
                <div className="text-left">
                  <p className="font-medium">{isMobile ? 'Mobile Wallet' : 'Browser Wallet'}</p>
                  <p className="text-xs text-muted-foreground">
                    {isMobile ? 'WalletConnect, QR Code' : 'MetaMask, Rabby, etc.'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
