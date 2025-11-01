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

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-3xl opacity-20 pointer-events-none" />

      {/* Hero Section */}
      <section className="relative w-full min-h-[85vh] flex items-center justify-center">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          {/* Tagline */}
          <p className="text-sm font-medium tracking-wide text-muted-foreground/60 mb-6 uppercase">
            Circle-powered DeFi automation
          </p>
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 mb-12 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium tracking-wide opacity-90">Arc Testnet • USDC gas • Sub-second finality</span>
          </div>
          
          {/* Main Headline */}
          <h1 className="text-6xl md:text-8xl font-bold leading-[1.05] tracking-tight mb-8">
            Stablecoin Treasury
            <br />
            <span className="bg-gradient-to-r from-primary via-accent to-success bg-clip-text text-transparent">
              on Arc Network
            </span>
          </h1>
          
          {/* Subline */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-3 leading-relaxed font-light">
            AI-powered allocations and automated rebalancing for USDC/EURC/XSGD.
          </p>
          <p className="text-base text-muted-foreground/60 mb-12 italic">
            One dashboard, zero complexity.
          </p>
          
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/dashboard">
              <Button 
                size="lg" 
                className="gap-2 bg-gradient-to-r from-primary to-accent hover:shadow-2xl hover:shadow-primary/30 hover:scale-105 transition-all px-10 h-14 rounded-2xl text-base font-semibold"
              >
                Launch App
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="https://docs.arc.network" target="_blank" rel="noopener noreferrer">
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2 px-10 h-14 rounded-2xl text-base font-semibold hover:bg-primary/5 hover:border-primary/40 transition-all"
              >
                <BookOpen className="w-5 h-5" />
                View Docs
              </Button>
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-10 text-sm opacity-70">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Open Source</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Audited Libraries</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Arc Native</span>
            </div>
          </div>
        </div>
      </section>

      {/* Value Cards */}
      <section className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Arc Treasury</h2>
          <p className="text-muted-foreground/70">Purpose-built for stablecoin finance</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {valueProps.map(({ icon: Icon, title, text }, i) => (
            <div
              key={title}
              className="group relative rounded-3xl border border-border/40 bg-gradient-to-b from-card/40 to-card/20 backdrop-blur-sm hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 p-8 hover:-translate-y-2"
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />
              
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-xl mb-3">{title}</h3>
                <p className="text-base text-muted-foreground leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Proof Section */}
      <section className="relative mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-10">Open Source & Verified</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a 
              className="group flex items-center gap-3 px-8 py-4 rounded-2xl border border-border/50 hover:border-primary/50 hover:bg-card/40 hover:shadow-lg hover:shadow-primary/5 transition-all w-full sm:w-auto" 
              href="https://github.com/vizzzix/arc_treasury" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Github className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="font-semibold">View on GitHub</span>
              <ExternalLink className="w-4 h-4 opacity-50 ml-auto" />
            </a>
            <a 
              className="group flex items-center gap-3 px-8 py-4 rounded-2xl border border-border/50 hover:border-primary/50 hover:bg-card/40 hover:shadow-lg hover:shadow-primary/5 transition-all w-full sm:w-auto" 
              href="https://testnet.arcscan.app/address/0x0B7950Ec78d5f7B53B120c889F83a6bd1fB0da59" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <span className="font-semibold">Live on ArcScan</span>
              <ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative mx-auto max-w-6xl px-6 py-16">
        <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-12 text-center overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(white,transparent_85%)]" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-8">Create your treasury on Arc Testnet in minutes</p>
            <Link to="/dashboard">
              <Button 
                size="lg" 
                className="gap-2 bg-gradient-to-r from-primary to-accent hover:shadow-2xl hover:shadow-primary/30 hover:scale-105 transition-all px-10 h-14 rounded-2xl text-base font-semibold"
              >
                Get started on Arc Testnet
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-border/50">
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
