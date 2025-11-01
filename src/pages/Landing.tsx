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
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-grid-white pointer-events-none" />
      
      {/* Minimal gradient accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none opacity-30" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none opacity-30" />

      {/* Hero Section */}
      <section className="relative w-full min-h-[90vh] flex items-center justify-center">
        <div className="mx-auto max-w-5xl px-6 py-32 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/20 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-xs font-medium tracking-wide text-muted-foreground">Arc Testnet • USDC gas • Sub-second finality</span>
          </div>
          
          {/* Main Headline */}
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight mb-6 text-foreground">
            Stablecoin Treasury
            <br />
            <span className="text-primary">on Arc Network</span>
          </h1>
          
          {/* Subline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-powered allocations and automated rebalancing for USDC/EURC/XSGD. One dashboard, zero complexity.
          </p>
          
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Link to="/dashboard">
              <Button 
                size="lg" 
                className="gap-2 px-8 h-12 rounded-xl text-base font-medium hover:bg-primary/90 transition-colors"
              >
                Launch App
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="https://docs.arc.network" target="_blank" rel="noopener noreferrer">
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2 px-8 h-12 rounded-xl text-base font-medium hover:bg-card transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                View Docs
              </Button>
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
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
      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Why Arc Treasury</h2>
          <p className="text-muted-foreground">Purpose-built for stablecoin finance</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {valueProps.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm hover:border-primary/30 hover:bg-card/40 transition-all duration-300 p-8"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative mx-auto max-w-4xl px-6 py-20">
        <div className="relative rounded-2xl border border-border/50 bg-card/20 backdrop-blur-sm p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to get started?</h2>
          <p className="text-muted-foreground mb-8">Create your treasury on Arc Testnet in minutes</p>
          <Link to="/dashboard">
            <Button 
              size="lg" 
              className="gap-2 px-8 h-12 rounded-xl text-base font-medium hover:bg-primary/90 transition-colors"
            >
              Get started on Arc Testnet
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Proof Section */}
      <section className="relative mx-auto max-w-4xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-sm font-medium mb-6 text-muted-foreground uppercase tracking-wider">Open Source & Verified</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              className="group flex items-center gap-2 px-6 py-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-card/30 transition-all text-sm font-medium" 
              href="https://github.com/vizzzix/arc_treasury" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Github className="w-4 h-4" />
              <span>View on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-50" />
            </a>
            <a 
              className="group flex items-center gap-2 px-6 py-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-card/30 transition-all text-sm font-medium" 
              href="https://testnet.arcscan.app/address/0x0B7950Ec78d5f7B53B120c889F83a6bd1fB0da59" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <span>Live on ArcScan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 px-6 border-t border-border/30">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Arc Treasury" className="w-5 h-5" />
              <span>© 2025 Arc Treasury. Built on Arc Network Testnet.</span>
            </div>
            <div className="flex items-center gap-5">
              <Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
              <a href="https://docs.arc.network" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Docs</a>
              <a href="https://github.com/vizzzix/arc_treasury" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
              <a href="https://x.com/claimpilot" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
