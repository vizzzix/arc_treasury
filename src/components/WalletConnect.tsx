import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, X, Smartphone, Monitor } from "lucide-react";

export const WalletConnect = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const [showModal, setShowModal] = useState(false);

  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <Button
        onClick={() => disconnect()}
        variant="outline"
        className="border-primary/30 hover:bg-primary/10 font-medium"
      >
        <Wallet className="w-4 h-4 mr-2" />
        {formatAddress(address)}
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

  // Check if we're on mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Check if injected provider (MetaMask, Rabby, etc.) is available
  const hasInjectedProvider = typeof window !== 'undefined' && !!(window as any).ethereum;

  // On mobile or when no injected provider, show modal for WalletConnect
  // On desktop with browser wallet, connect directly
  const handleButtonClick = () => {
    if (isMobile || !hasInjectedProvider) {
      // Show modal to choose WalletConnect or Browser Wallet
      setShowModal(true);
    } else {
      // On desktop with browser extension, connect directly (MetaMask, Rabby, etc.)
      const injectedConnector = connectors.find(c => c.id === 'injected');
      if (injectedConnector) {
        connect({ connector: injectedConnector });
      } else {
        // Fallback to modal if no injected connector
        setShowModal(true);
      }
    }
  };

  return (
    <>
      <Button
        onClick={handleButtonClick}
        disabled={isPending}
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-glow hover:shadow-glow-lg transition-all"
      >
        <Wallet className="w-4 h-4 mr-2" />
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </Button>

      {/* Wallet Selection Modal - rendered via Portal to body */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Connect Wallet</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Browser Extension (MetaMask, etc.) */}
              <button
                onClick={() => handleConnect('injected')}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <Monitor className="w-5 h-5 text-orange-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Browser Wallet</p>
                  <p className="text-xs text-muted-foreground">MetaMask, Rabby, etc.</p>
                </div>
              </button>

              {/* WalletConnect (Mobile) */}
              <button
                onClick={() => handleConnect('walletConnect')}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Smartphone className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Mobile Wallet</p>
                  <p className="text-xs text-muted-foreground">WalletConnect, QR Code</p>
                </div>
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              New to crypto? Get <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MetaMask</a>
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
