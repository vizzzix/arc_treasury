import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useCircleWallet } from '@/providers/CircleWalletProvider';
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, X, Smartphone, Monitor, Mail, Chrome } from "lucide-react";

export const WalletConnect = () => {
  const account = useAccount();
  const externalAddress = account?.address;
  const isExternalConnected = account?.isConnected ?? false;

  const circleWallet = useCircleWallet();

  const [showModal, setShowModal] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

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
    } catch (err) {
      console.error('Google login failed:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email) return;
    setAuthLoading(true);
    try {
      if (!otpSent) {
        await circleWallet.signInWithEmail(email);
        setOtpSent(true);
      } else {
        await circleWallet.verifyOtp(email, otp);
        setShowModal(false);
        resetEmailState();
      }
    } catch (err) {
      console.error('Email auth failed:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const resetEmailState = () => {
    setShowEmailInput(false);
    setEmail('');
    setOtpSent(false);
    setOtp('');
  };

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const hasInjectedProvider = typeof window !== 'undefined' && !!(window as any).ethereum;

  const handleButtonClick = () => {
    setShowModal(true);
  };

  return (
    <>
      <Button
        onClick={handleButtonClick}
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
                onClick={() => { setShowModal(false); resetEmailState(); }}
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

              {/* Email Login */}
              {!showEmailInput ? (
                <button
                  onClick={() => setShowEmailInput(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Mail className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Continue with Email</p>
                    <p className="text-xs text-muted-foreground">Magic link login</p>
                  </div>
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  {!otpSent ? (
                    <>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:border-primary"
                        onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                      />
                      <button
                        onClick={handleEmailSubmit}
                        disabled={!email || authLoading}
                        className="w-full py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        {authLoading ? 'Sending...' : 'Send Code'}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">Code sent to {email}</p>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter 6-digit code"
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:border-primary"
                        onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                      />
                      <button
                        onClick={handleEmailSubmit}
                        disabled={!otp || authLoading}
                        className="w-full py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        {authLoading ? 'Verifying...' : 'Verify'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/10"></div>
                <span className="text-xs text-muted-foreground">or connect wallet</span>
                <div className="flex-1 h-px bg-white/10"></div>
              </div>

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
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
