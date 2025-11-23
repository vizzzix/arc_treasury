import { Button } from "@/components/ui/button";
import { YieldCalculator } from "@/components/YieldCalculator";
import { FeatureCard } from "@/components/FeatureCard";
import { WalletConnect } from "@/components/WalletConnect";
import { WhitelistForm } from "@/components/WhitelistForm";
import { Vault, Coins, TrendingUp, ArrowRight, Github, Twitter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import arcLogo from "@/assets/arc-logo.png";
import heroBg from "@/assets/hero-bg.png";

const Landing = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const isConnected = account?.isConnected ?? false;
  const { apy, isLoading: isLoadingAPY } = useUSYCPrice();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={arcLogo} alt="Arc Treasury" className="w-10 h-10" />
              <span className="text-2xl font-bold">Arc Treasury</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate("/dashboard")}
                variant="outline"
                className="border-primary/30 hover:bg-primary/10 font-medium"
              >
                Dashboard
              </Button>
              <WalletConnect />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="relative overflow-hidden pt-24 min-h-screen flex items-center"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        {/* Static Overlay with gradient blend */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/95 to-background/80" />
        
        {/* Static gradient accents */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />


        <div className="relative z-10 container mx-auto px-6 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left: Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight tracking-tight">
                  A digital vault for your{" "}
                  <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                    stablecoins
                  </span>{" "}
                  on Arc.
                </h1>
                <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl">
                  Deposit USDC and EURC into a secure on-chain vault. See your balance and simulated yield, powered by USYC, on Arc Testnet.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => navigate("/app")}
                  size="lg"
                  className="group bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6 shadow-glow-lg hover:shadow-glow transition-all hover:scale-105"
                >
                  Launch App
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  onClick={() => navigate("/faq")}
                  size="lg"
                  variant="ghost"
                  className="font-semibold text-lg px-8 py-6 hover:underline"
                >
                  How it works
                </Button>
              </div>
            </div>

            {/* Right: Yield Calculator */}
            <div className="lg:pl-8">
              <div className="relative">
                {/* Glow effect behind calculator */}
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-xl transform scale-105" />
                <YieldCalculator baseAPY={apy} autoPlay={true} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        
        <div className="relative container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Premium Treasury Features
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto items-stretch">
            <div className="flex">
              <FeatureCard
                icon={Vault}
                title="Safe Balance"
                description="Store stablecoins in a dedicated smart-contract vault."
              />
            </div>
            <div className="flex">
              <FeatureCard
                icon={Coins}
                title="Multi-currency"
                description="Manage USDC and EURC together in one clean dashboard."
              />
            </div>
            <div className="flex">
              <FeatureCard
                icon={TrendingUp}
                title="USYC reference yield"
                description={
                  isLoadingAPY
                    ? "Loading live APY from Hashnote..."
                    : `Current APY: ${apy.toFixed(2)}% - Live from Hashnote API`
                }
              />
            </div>
          </div>
        </div>
      </section>


      {/* Whitelist Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        
        <div className="relative container mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-card border border-border/50 rounded-xl p-8 lg:p-12 shadow-lg">
              <h3 className="text-2xl lg:text-3xl font-bold mb-4 text-center">
                Join the Whitelist
              </h3>
              <p className="text-muted-foreground text-center mb-8">
                Get early access to Arc Treasury features and updates.
              </p>
              <WhitelistForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 overflow-hidden">
        {/* Subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
        
        <div className="relative container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Navigation Links */}
            <div className="flex justify-center md:justify-start gap-6 text-sm text-muted-foreground">
              <button onClick={() => navigate("/faq")} className="hover:text-primary transition-colors">
                FAQ
              </button>
              <button onClick={() => navigate("/documentation")} className="hover:text-primary transition-colors">
                Documentation
              </button>
              <button
                onClick={() => navigate("/support")}
                className="hover:text-primary transition-colors"
              >
                Support
              </button>
            </div>

            <div className="flex justify-center md:justify-end items-center gap-4">
              <a
                href="https://github.com/vizzzix/arc_treasury"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-card border border-transparent hover:border-primary/30 transition-all group hover:scale-110"
              >
                <Github className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
              <a
                href="https://twitter.com/arc_treasury"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-card border border-transparent hover:border-primary/30 transition-all group hover:scale-110"
              >
                <Twitter className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-8 pt-8 border-t border-border/30 text-center">
            <p className="text-sm text-muted-foreground">
              © 2025 Arc Treasury. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
