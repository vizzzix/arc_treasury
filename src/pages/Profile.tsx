import { useState } from "react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import {
  Settings,
  Wallet,
  Shield,
  Mail,
  Bell,
  Key,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Link,
} from "lucide-react";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [copiedBound, setCopiedBound] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [txNotifications, setTxNotifications] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // EVM wallet binding
  const [evmWalletInput, setEvmWalletInput] = useState("");
  const [boundEvmWallet, setBoundEvmWallet] = useState<string | null>(
    localStorage.getItem(`bound_evm_${account?.address}`)
  );

  const isConnected = account?.isConnected ?? false;
  const address = account?.address;

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyBoundAddress = () => {
    if (boundEvmWallet) {
      navigator.clipboard.writeText(boundEvmWallet);
      setCopiedBound(true);
      toast({
        title: "Address Copied",
        description: "Bound EVM wallet address copied to clipboard",
      });
      setTimeout(() => setCopiedBound(false), 2000);
    }
  };

  const isValidEVMAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  const handleBindWallet = () => {
    if (!evmWalletInput) {
      toast({
        title: "Error",
        description: "Please enter an EVM wallet address",
        variant: "destructive",
      });
      return;
    }

    if (!isValidEVMAddress(evmWalletInput)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid EVM wallet address (0x...)",
        variant: "destructive",
      });
      return;
    }

    // Save to localStorage
    if (address) {
      localStorage.setItem(`bound_evm_${address}`, evmWalletInput);
      setBoundEvmWallet(evmWalletInput);
      setEvmWalletInput("");
      toast({
        title: "Wallet Bound Successfully",
        description: "Your EVM wallet has been linked to your profile",
      });
    }
  };

  const handleUnbindWallet = () => {
    if (address) {
      localStorage.removeItem(`bound_evm_${address}`);
      setBoundEvmWallet(null);
      toast({
        title: "Wallet Unbound",
        description: "Your EVM wallet has been unlinked",
      });
    }
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const shortBoundAddress = boundEvmWallet
    ? `${boundEvmWallet.slice(0, 6)}...${boundEvmWallet.slice(-4)}`
    : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate("/dashboard")}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Button>
              <h1 className="text-xl font-bold">Profile & Settings</h1>
            </div>
            <div className="flex items-center gap-3">
              {isConnected ? (
                <UserMenu />
              ) : (
                <WalletConnect />
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 container mx-auto px-6">
        {!isConnected ? (
          <div className="max-w-md mx-auto mt-20 text-center">
            <Card className="p-8">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">
                Connect Your Wallet
              </h2>
              <p className="text-muted-foreground mb-6">
                Please connect your wallet to view your profile and settings.
              </p>
              <WalletConnect />
            </Card>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Profile Section: Wallet + Settings */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Wallet Info */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Wallet
                  </h3>
                  <div className="space-y-3">
                    {/* Address */}
                    <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                      <label className="text-sm text-muted-foreground mb-2 block">
                        Wallet Address
                      </label>
                      <div className="flex items-center justify-between gap-4">
                        <code className="text-sm font-mono">{address}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyAddress}
                          className="gap-2"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Network */}
                    <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                      <label className="text-sm text-muted-foreground mb-2 block">
                        Connected Network
                      </label>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {SUPPORTED_NETWORKS.arcTestnet.name}
                        </span>
                        <a
                          href={`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-sm"
                        >
                          View on Explorer
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Disconnect */}
                    <div>
                      <WalletConnect />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/50" />

                {/* Bind EVM Wallet */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    Bind EVM Wallet
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Link your external EVM wallet address for cross-chain operations and referrals
                  </p>

                  {boundEvmWallet ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                        <label className="text-sm text-green-600 dark:text-green-400 mb-2 block font-semibold">
                          ✓ Bound EVM Wallet
                        </label>
                        <div className="flex items-center justify-between gap-4">
                          <code className="text-sm font-mono text-foreground">{boundEvmWallet}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={copyBoundAddress}
                            className="gap-2"
                          >
                            {copiedBound ? (
                              <>
                                <Check className="w-4 h-4" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUnbindWallet}
                        className="w-full"
                      >
                        Unbind Wallet
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                        <label className="text-sm text-muted-foreground mb-2 block">
                          EVM Wallet Address
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="0x..."
                            value={evmWalletInput}
                            onChange={(e) => setEvmWalletInput(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <Button
                            onClick={handleBindWallet}
                            size="sm"
                            className="whitespace-nowrap"
                          >
                            Bind Wallet
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Enter a valid EVM address (Ethereum, BSC, Polygon, etc.)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-border/50" />

                {/* Security Settings */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Security & Settings
                  </h3>
                  <div className="space-y-4">
                    {/* 2FA Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                            <Key className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">
                              Two-Factor Authentication
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Add extra security to your account
                            </p>
                          </div>
                        </div>
                        <Button
                          variant={twoFactorEnabled ? "outline" : "default"}
                          size="sm"
                          onClick={() => {
                            setTwoFactorEnabled(!twoFactorEnabled);
                            toast({
                              title: twoFactorEnabled
                                ? "2FA Disabled"
                                : "2FA Enabled",
                              description: twoFactorEnabled
                                ? "Two-factor authentication has been disabled"
                                : "Two-factor authentication has been enabled",
                            });
                          }}
                        >
                          {twoFactorEnabled ? "Enabled" : "Enable 2FA"}
                        </Button>
                      </div>

                      {twoFactorEnabled && (
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                          <p className="text-sm text-green-600 dark:text-green-400">
                            ✓ Two-factor authentication is active on your account
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border/50 pt-4" />

                    {/* Email Notifications */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                            <Mail className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <h4 className="font-medium">Email Notifications</h4>
                            <p className="text-sm text-muted-foreground">
                              Receive updates via email
                            </p>
                          </div>
                        </div>
                        <Button
                          variant={emailNotifications ? "outline" : "ghost"}
                          size="sm"
                          onClick={() => setEmailNotifications(!emailNotifications)}
                        >
                          {emailNotifications ? "On" : "Off"}
                        </Button>
                      </div>

                      {emailNotifications && (
                        <div className="pl-14">
                          <input
                            type="email"
                            placeholder="your@email.com"
                            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            We'll send unlock reminders and transaction summaries
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border/50 pt-4" />

                    {/* Transaction Notifications */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                          <Bell className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h4 className="font-medium">Transaction Alerts</h4>
                          <p className="text-sm text-muted-foreground">
                            Get notified for deposits and withdrawals
                          </p>
                        </div>
                      </div>
                      <Button
                        variant={txNotifications ? "outline" : "ghost"}
                        size="sm"
                        onClick={() => setTxNotifications(!txNotifications)}
                      >
                        {txNotifications ? "On" : "Off"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
