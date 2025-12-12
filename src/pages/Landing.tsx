import { Button } from "@/components/ui/button";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { WhitelistForm } from "@/components/WhitelistForm";
import { useAccount } from "wagmi";
import { Vault, Coins, TrendingUp, ArrowRight, Github, Twitter, Shield, Zap, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import arcLogo from "@/assets/arc-logo.png";
import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

const Landing = () => {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const { apy, isLoading: isLoadingAPY } = useUSYCPrice();
  const { eurToUsd } = useExchangeRate();
  const [usdcAmount, setUsdcAmount] = useState("");
  const [eurcAmount, setEurcAmount] = useState("");
  const [userInteracted, setUserInteracted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const animationDone = useRef(false);

  // Auto-typing animation - slow and smooth like real typing
  useEffect(() => {
    if (animationDone.current || userInteracted) return;

    const targetUsdc = "100000";
    const targetEurc = "50000";
    let cancelled = false;

    const typeCharacter = (
      target: string,
      setter: (val: string) => void,
      index: number,
      onComplete: () => void
    ) => {
      if (cancelled || userInteracted) return;

      if (index <= target.length) {
        setter(target.slice(0, index));
        // Random delay between 80-180ms per character for natural feel
        const delay = 100 + Math.random() * 100;
        setTimeout(() => typeCharacter(target, setter, index + 1, onComplete), delay);
      } else {
        onComplete();
      }
    };

    // Start after 1 second delay
    const startTimer = setTimeout(() => {
      if (cancelled || userInteracted) return;

      // Type USDC first
      typeCharacter(targetUsdc, setUsdcAmount, 1, () => {
        // Pause 600ms, then type EURC
        setTimeout(() => {
          if (cancelled || userInteracted) return;
          typeCharacter(targetEurc, setEurcAmount, 1, () => {
            animationDone.current = true;
          });
        }, 600);
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
    };
  }, [userInteracted]);

  const handleUserInput = () => {
    if (!animationDone.current) {
      setUserInteracted(true);
      animationDone.current = true;
    }
  };

  const earnings = useMemo(() => {
    const usdc = parseFloat(usdcAmount) || 0;
    const eurc = parseFloat(eurcAmount) || 0;
    const totalUsd = usdc + (eurc * eurToUsd);
    const annual = totalUsd * (apy / 100);
    return {
      monthly: annual / 12,
      annual,
      total: totalUsd + annual
    };
  }, [usdcAmount, eurcAmount, eurToUsd, apy]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute top-0 -right-40 w-80 h-80 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/2 w-80 h-80 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
      </div>

      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/20 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={arcLogo} alt="Arc Treasury" className="w-8 h-8 sm:w-10 sm:h-10" />
              <span className="text-xl sm:text-2xl font-bold">Arc Treasury</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-3">
              <Button
                onClick={() => navigate("/dashboard")}
                variant="ghost"
                className="hover:bg-white/10 font-medium"
              >
                Dashboard
              </Button>
              <Button
                onClick={() => navigate("/swap")}
                variant="ghost"
                className="hover:bg-white/10 font-medium"
              >
                Swap
              </Button>
              <Button
                onClick={() => navigate("/bridge")}
                variant="ghost"
                className="hover:bg-white/10 font-medium"
              >
                Bridge
              </Button>
              {isConnected ? <UserMenu /> : <WalletConnect />}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              {isConnected ? <UserMenu /> : <WalletConnect />}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="hover:bg-white/10"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-2 border-t border-border/20 pt-4 space-y-2">
              <Button
                onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }}
                variant="ghost"
                className="w-full justify-start hover:bg-white/10 font-medium"
              >
                Dashboard
              </Button>
              <Button
                onClick={() => { navigate("/swap"); setMobileMenuOpen(false); }}
                variant="ghost"
                className="w-full justify-start hover:bg-white/10 font-medium"
              >
                Swap
              </Button>
              <Button
                onClick={() => { navigate("/bridge"); setMobileMenuOpen(false); }}
                variant="ghost"
                className="w-full justify-start hover:bg-white/10 font-medium"
              >
                Bridge
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-32">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left: Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary">
                  <Zap className="w-4 h-4" />
                  Live on Arc Testnet
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold leading-tight tracking-tight">
                  A digital vault for your{" "}
                  <span className="bg-gradient-to-r from-primary to-green-400 bg-clip-text text-transparent">
                    stablecoins
                  </span>{" "}
                  on Arc
                </h1>
                <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl">
                  Deposit USDC/EURC → earn real yield from US Treasury Bills via USYC. Institutional-grade, on-chain.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => navigate("/dashboard")}
                  size="lg"
                  className="group bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6 rounded-xl"
                >
                  Launch App
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  onClick={() => navigate("/litepaper")}
                  size="lg"
                  variant="outline"
                  className="font-semibold text-lg px-8 py-6 rounded-xl border-white/10 hover:bg-white/5"
                >
                  Read Litepaper
                </Button>
              </div>
            </div>

            {/* Right: Compact Calculator */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-3xl" />
              <div className="relative p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
                <h3 className="text-lg font-semibold mb-4">Calculate Earnings</h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">USDC</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={usdcAmount}
                          onChange={(e) => { handleUserInput(); setUsdcAmount(e.target.value); }}
                          onFocus={handleUserInput}
                          className="pl-8 h-12 text-lg bg-white/5 border-white/10 rounded-xl"
                          placeholder="100000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">EURC</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                        <Input
                          type="number"
                          value={eurcAmount}
                          onChange={(e) => { handleUserInput(); setEurcAmount(e.target.value); }}
                          onFocus={handleUserInput}
                          className="pl-8 h-12 text-lg bg-white/5 border-white/10 rounded-xl"
                          placeholder="50000"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                      <p className="text-lg font-bold text-green-400">
                        +${earnings.monthly.toFixed(0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Annual</p>
                      <p className="text-lg font-bold text-green-400">
                        +${earnings.annual.toFixed(0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total</p>
                      <p className="text-lg font-bold text-primary">
                        ${earnings.total.toFixed(0)}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center pt-2">
                    *Based on {apy.toFixed(2)}% APY from USYC T-Bill yield
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-12 sm:py-20 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4">
              Why Arc Treasury?
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Real yield from US Treasury Bills, tokenized on-chain
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 max-w-5xl mx-auto">
            {[
              { icon: Shield, title: "Secure", desc: "Audited contracts" },
              { icon: TrendingUp, title: `${apy.toFixed(1)}% APY`, desc: "Real T-Bill yield" },
              { icon: Coins, title: "USDC/EURC", desc: "Multi-stablecoin" },
              { icon: Vault, title: "Instant", desc: "Withdraw anytime" },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm hover:border-primary/30 transition-all group"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-0.5 sm:mb-1">{feature.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-12 sm:py-20 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4">How It Works</h2>
              <p className="text-sm sm:text-base text-muted-foreground">Your stablecoins → USYC → Real yield</p>
            </div>

            <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm space-y-4 sm:space-y-6">
              {/* Flow diagram */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <div className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs sm:text-base font-medium">
                  USDC/EURC
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <div className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs sm:text-base font-medium">
                  Arc Treasury
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <div className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs sm:text-base font-medium">
                  USYC
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <div className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs sm:text-base font-bold">
                  ~{apy.toFixed(1)}% APY
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t border-white/10">
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-primary">{apy.toFixed(2)}%</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Net APY</p>
                </div>
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold">24/7</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Instant access</p>
                </div>
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-green-400">0%</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">No fees</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Whitelist Section */}
      <section className="relative py-20 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-xl mx-auto">
            <div className="p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-2 text-center">
                Join the Whitelist
              </h3>
              <p className="text-muted-foreground text-center mb-6 text-sm">
                Early access to mainnet launch and exclusive rewards
              </p>
              <WhitelistForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <button onClick={() => navigate("/faq")} className="hover:text-primary transition-colors">
                FAQ
              </button>
              <button onClick={() => navigate("/litepaper")} className="hover:text-primary transition-colors">
                Litepaper
              </button>
              <button onClick={() => navigate("/support")} className="hover:text-primary transition-colors">
                Support
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              © 2025 Arc Treasury
            </p>

            <div className="flex items-center gap-3">
              <a
                href="https://github.com/vizzzix/arc_treasury"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
              >
                <Github className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
              </a>
              <a
                href="https://x.com/arctreasury"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
              >
                <Twitter className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
