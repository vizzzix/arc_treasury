import { useState, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import TwitterConnect from "@/components/TwitterConnect";
import { ArrowLeft, ExternalLink, Copy, Check, Wallet, Link, Mail, Loader2, Shield } from "lucide-react";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface BindingData {
  address: string;
  signature: string;
  timestamp: number;
}

interface EmailBindingData {
  email: string;
  verified: boolean;
  verificationCode?: string;
  timestamp: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const { toast } = useToast();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  const [copied, setCopied] = useState(false);
  const [copiedBound, setCopiedBound] = useState(false);

  // EVM wallet binding with signature
  const [evmWalletInput, setEvmWalletInput] = useState("");
  const [boundEvmWallet, setBoundEvmWallet] = useState<BindingData | null>(null);
  const [isBindingEvm, setIsBindingEvm] = useState(false);

  // Email binding
  const [email, setEmail] = useState("");
  const [boundEmail, setBoundEmail] = useState<EmailBindingData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showVerificationInput, setShowVerificationInput] = useState(false);

  const isConnected = account?.isConnected ?? false;
  const address = account?.address;

  // Load saved bindings on mount
  useEffect(() => {
    if (address) {
      const savedEvm = localStorage.getItem(`bound_evm_verified_${address}`);
      if (savedEvm) {
        try {
          setBoundEvmWallet(JSON.parse(savedEvm));
        } catch { /* ignore */ }
      }

      const savedEmail = localStorage.getItem(`bound_email_${address}`);
      if (savedEmail) {
        try {
          setBoundEmail(JSON.parse(savedEmail));
        } catch { /* ignore */ }
      }
    }
  }, [address]);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast({ title: "Copied!", description: "Address copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyBoundAddress = () => {
    if (boundEvmWallet) {
      navigator.clipboard.writeText(boundEvmWallet.address);
      setCopiedBound(true);
      toast({ title: "Copied!", description: "Bound address copied" });
      setTimeout(() => setCopiedBound(false), 2000);
    }
  };

  const isValidEVMAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Bind EVM wallet with signature verification
  const handleBindWallet = async () => {
    if (!evmWalletInput || !isValidEVMAddress(evmWalletInput)) {
      toast({ title: "Invalid Address", description: "Enter a valid EVM address (0x...)", variant: "destructive" });
      return;
    }
    if (!address) return;

    setIsBindingEvm(true);
    try {
      const timestamp = Date.now();
      const message = `I authorize binding wallet ${evmWalletInput} to my Arc Treasury account ${address}\n\nTimestamp: ${timestamp}`;

      const signature = await signMessageAsync({ message });

      const bindingData: BindingData = {
        address: evmWalletInput,
        signature,
        timestamp,
      };

      localStorage.setItem(`bound_evm_verified_${address}`, JSON.stringify(bindingData));
      setBoundEvmWallet(bindingData);
      setEvmWalletInput("");
      toast({ title: "Wallet Bound", description: "EVM wallet verified and linked!" });
    } catch (error) {
      toast({ title: "Binding Failed", description: "Signature rejected or failed", variant: "destructive" });
    } finally {
      setIsBindingEvm(false);
    }
  };

  const handleUnbindWallet = () => {
    if (address) {
      localStorage.removeItem(`bound_evm_verified_${address}`);
      setBoundEvmWallet(null);
      toast({ title: "Wallet Unbound", description: "EVM wallet unlinked" });
    }
  };

  // Email binding with verification code via Resend API
  const handleSendVerification = async () => {
    if (!isValidEmail(email)) {
      toast({ title: "Invalid Email", description: "Enter a valid email address", variant: "destructive" });
      return;
    }
    if (!address) return;

    setIsVerifying(true);
    try {
      const response = await fetch('/api/email?action=send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, walletAddress: address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      const emailData: EmailBindingData = {
        email,
        verified: false,
        timestamp: Date.now(),
      };

      localStorage.setItem(`bound_email_${address}`, JSON.stringify(emailData));
      setBoundEmail(emailData);
      setShowVerificationInput(true);

      toast({
        title: "Verification Code Sent",
        description: `Check your inbox at ${email}`
      });
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "Could not send verification", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!boundEmail || !verificationCode || !address) return;

    setIsVerifying(true);
    try {
      const response = await fetch('/api/email?action=verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: boundEmail.email,
          walletAddress: address,
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      const verifiedData: EmailBindingData = {
        email: boundEmail.email,
        verified: true,
        timestamp: Date.now(),
      };

      localStorage.setItem(`bound_email_${address}`, JSON.stringify(verifiedData));
      setBoundEmail(verifiedData);
      setShowVerificationInput(false);
      setVerificationCode("");
      toast({ title: "Email Verified!", description: "Your email has been linked to your account" });
    } catch (error) {
      toast({ title: "Invalid Code", description: error instanceof Error ? error.message : "The verification code is incorrect", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUnbindEmail = () => {
    if (address) {
      localStorage.removeItem(`bound_email_${address}`);
      setBoundEmail(null);
      setEmail("");
      setShowVerificationInput(false);
      setVerificationCode("");
      toast({ title: "Email Unbound", description: "Email unlinked from account" });
    }
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
              <h1 className="text-lg font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Profile</h1>
            </div>
            {isConnected ? <UserMenu /> : <WalletConnect />}
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 container mx-auto px-6 max-w-2xl">
        {!isConnected ? (
          <div className="flex flex-col items-center gap-6 py-20">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
              <p className="text-sm text-muted-foreground">Connect your wallet to view profile</p>
            </div>
            <WalletConnect />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Wallet Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Connected Wallet</h3>
                <div className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                  Connected
                </div>
              </div>

              {/* Address */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm truncate">{address}</p>
                  <p className="text-sm text-muted-foreground">{SUPPORTED_NETWORKS.arcTestnet.name}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={copyAddress} variant="outline" className="flex-1 gap-2 rounded-xl h-11">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  onClick={() => window.open(`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${address}`, '_blank')}
                  variant="outline"
                  className="flex-1 gap-2 rounded-xl h-11"
                >
                  <ExternalLink className="w-4 h-4" />
                  Explorer
                </Button>
              </div>
            </div>

            {/* Bind EVM Wallet */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Link className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Bind EVM Wallet</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Link external EVM wallet with signature verification</p>

              {boundEvmWallet ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Shield className="w-3 h-3 text-green-400" />
                          <p className="text-xs text-green-400 font-medium">Verified & Bound</p>
                        </div>
                        <p className="font-mono text-sm truncate">{boundEvmWallet.address}</p>
                      </div>
                      <Button onClick={copyBoundAddress} variant="ghost" size="sm">
                        {copiedBound ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button onClick={handleUnbindWallet} variant="outline" className="w-full rounded-xl h-11">
                    Unbind Wallet
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="0x..."
                      value={evmWalletInput}
                      onChange={(e) => setEvmWalletInput(e.target.value)}
                      className="font-mono text-sm rounded-xl"
                      disabled={isBindingEvm || isSigning}
                    />
                    <Button
                      onClick={handleBindWallet}
                      className="rounded-xl px-6"
                      disabled={isBindingEvm || isSigning || !evmWalletInput}
                    >
                      {isBindingEvm || isSigning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Sign & Bind"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You'll be asked to sign a message to verify ownership
                  </p>
                </div>
              )}
            </div>

            {/* Twitter Boost */}
            <TwitterConnect />

            {/* Email Linking */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Email</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Link your email for notifications and recovery</p>

              {boundEmail?.verified ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Shield className="w-3 h-3 text-green-400" />
                          <p className="text-xs text-green-400 font-medium">Verified</p>
                        </div>
                        <p className="text-sm truncate">{boundEmail.email}</p>
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleUnbindEmail} variant="outline" className="w-full rounded-xl h-11">
                    Unlink Email
                  </Button>
                </div>
              ) : showVerificationInput ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                    <p className="text-sm text-blue-400">
                      Verification code sent to <span className="font-medium">{boundEmail?.email}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="font-mono text-sm rounded-xl text-center tracking-widest"
                      maxLength={6}
                    />
                    <Button
                      onClick={handleVerifyEmail}
                      className="rounded-xl px-6"
                      disabled={verificationCode.length !== 6}
                    >
                      Verify
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      setShowVerificationInput(false);
                      setBoundEmail(null);
                      setEmail("");
                    }}
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                  >
                    Use different email
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="text-sm rounded-xl"
                      disabled={isVerifying}
                    />
                    <Button
                      onClick={handleSendVerification}
                      className="rounded-xl px-6"
                      disabled={isVerifying || !email}
                    >
                      {isVerifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Send Code"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We'll send a verification code to confirm your email
                  </p>
                </div>
              )}
            </div>

            {/* Session */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Session</h3>
              <WalletConnect />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
