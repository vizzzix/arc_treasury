import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Github, ExternalLink, Sparkles, LineChart, LayoutGrid, CheckCircle2 } from "lucide-react";

const Landing = () => {
  const valueProps = [
    {
      icon: Sparkles,
      title: "Arc-Native",
      text: "USDC gas, deterministic fees, <1s finality."
    },
    {
      icon: LineChart,
      title: "AI Allocations",
      text: "Strategies & auto-rebalance with thresholds."
    },
    {
      icon: LayoutGrid,
      title: "One Dashboard",
      text: "USDC/EURC/XSGD, swaps and analytics."
    },
  ];

  const steps = [
    { number: "1", title: "Connect Wallet", description: "MetaMask to Arc Testnet" },
    { number: "2", title: "Create Treasury", description: "Choose your strategy" },
    { number: "3", title: "Deposit & Rebalance", description: "AI manages allocations" }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-3xl opacity-20 pointer-events-none" />

      {/* Hero Section */}
      <section className="relative w-full">
        <div className="mx-auto max-w-5xl px-6 pt-32 pb-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 mb-10 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium tracking-wide">Arc Testnet • USDC gas • Sub-second finality</span>
          </div>
          
          {/* Main Headline */}
          <div className="space-y-4 mb-8">
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight">
              <span className="block">Stablecoin Treasury</span>
              <span className="block bg-gradient-to-r from-primary via-accent to-success bg-clip-text text-transparent">
                on Arc Network
              </span>
            </h1>
          </div>
          
          {/* Subline */}
          <div className="max-w-2xl mx-auto mb-12 space-y-3">
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              AI-powered allocations and automated rebalancing
              <br className="hidden md:block" />
              {" "}for USDC/EURC/XSGD.
            </p>
            <p className="text-base text-muted-foreground/80">
              One dashboard, zero complexity.
            </p>
          </div>
          
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/dashboard">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 hover:scale-105 transition-all px-8 h-12 rounded-xl text-base shadow-lg shadow-primary/20">
                Launch App
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="https://docs.arc.network" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="gap-2 px-8 h-12 rounded-xl text-base hover:bg-primary/5 hover:border-primary/30">
                <BookOpen className="w-4 h-4" />
                View Docs
              </Button>
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground/80">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Open Source</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground/80">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Audited Libraries</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground/80">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Arc Native</span>
            </div>
          </div>
        </div>
      </section>

      {/* Value Cards */}
      <section className="relative mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {valueProps.map(({ icon: Icon, title, text }, i) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-border bg-card/30 backdrop-blur-sm hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 p-6 hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">How It Works</h2>
          <p className="text-muted-foreground">Get started in minutes</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-10 left-[16.666%] right-[16.666%] h-0.5 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0" />
          
          {steps.map((step, i) => (
            <div key={i} className="relative group">
              <div className="relative p-8 rounded-2xl border border-border/50 bg-card/20 hover:bg-card/40 hover:border-primary/30 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/5">
                {/* Number badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                  {step.number}
                </div>
                
                <div className="pt-6 text-center space-y-3">
                  <h3 className="font-semibold text-lg">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-12">
          <Link to="/dashboard">
            <Button variant="outline" className="rounded-xl hover:bg-primary/5 hover:border-primary/30 hover:scale-105 transition-all px-6">
              Get Test Tokens
            </Button>
          </Link>
        </div>
      </section>

      {/* Proof Section */}
      <section className="relative mx-auto max-w-5xl px-6 py-12">
        <div className="text-center space-y-6">
          <h2 className="text-2xl font-bold mb-8">Built with Transparency</h2>
          <div className="flex items-center justify-center gap-8">
            <a 
              className="group flex items-center gap-2 px-6 py-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all" 
              href="https://github.com/vizzzix/arc_treasury" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Github className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">GitHub</span>
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
            <a 
              className="group flex items-center gap-2 px-6 py-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all" 
              href="https://testnet.arcscan.app/address/0x0B7950Ec78d5f7B53B120c889F83a6bd1fB0da59" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <span className="font-medium">View on ArcScan</span>
              <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-border/50 mt-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Arc Treasury" className="w-6 h-6" />
              <span>© 2025 Arc Treasury. Built on Arc Network Testnet.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/faq" className="hover:text-primary transition-colors">FAQ</Link>
              <a href="https://docs.arc.network" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Docs</a>
              <a href="https://github.com/vizzzix/arc_treasury" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">GitHub</a>
              <a href="https://x.com/claimpilot" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
