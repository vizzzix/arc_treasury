import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Github, ExternalLink, Zap, TrendingUp, BarChart3 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Landing = () => {
  const valueProps = [
    {
      icon: Zap,
      title: "Arc-Native",
      description: "USDC-gas, deterministic fees, <1s finality"
    },
    {
      icon: TrendingUp,
      title: "AI Allocations",
      description: "Conservative/Balanced/Aggressive + auto-rebalance"
    },
    {
      icon: BarChart3,
      title: "One Dashboard",
      description: "Multi-stable (USDC/EURC/XSGD), swaps, analytics"
    },
  ];

  const steps = [
    { number: "1", title: "Connect Wallet", description: "MetaMask to Arc Testnet" },
    { number: "2", title: "Create Treasury", description: "Choose your strategy" },
    { number: "3", title: "Deposit & Rebalance", description: "AI manages allocations" }
  ];

  const faqs = [
    {
      q: "What is Arc Treasury?",
      a: "A stablecoin treasury management platform on Arc Network with automated rebalancing, yield generation, and zero-fee swaps for USDC/EURC/XSGD."
    },
    {
      q: "How does it differ from Aave/Compound?",
      a: "Arc Treasury provides unified multi-asset management, automated rebalancing strategies, and USDC-denominated gas fees — all in one dashboard."
    },
    {
      q: "Why Arc Network?",
      a: "USDC-native gas payments, sub-second finality, deterministic fees, and EVM compatibility make Arc ideal for stablecoin finance."
    },
    {
      q: "Is this real money?",
      a: "Currently on Arc Testnet with mock tokens. Production deployment with real assets will follow security audits."
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center space-y-6">
            {/* Top badges */}
            <div className="text-sm text-muted-foreground">
              Arc Testnet • USDC gas • Sub-second finality
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Stablecoin Treasury on Arc — Automated, USDC-gas, sub-second finality
            </h1>
            
            {/* Subline */}
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Manage USDC/EURC/XSGD in one dashboard: AI allocations, auto-rebalance, testnet yield simulation.
            </p>
            
            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link to="/dashboard">
                <Button size="lg" className="gap-2">
                  Launch App
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="https://docs.arc.network" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  View Docs
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props - 3 Cards */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-3 gap-6">
            {valueProps.map((prop, i) => (
              <div key={i} className="p-6 border border-border/50 rounded-lg hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <prop.icon className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">{prop.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{prop.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {steps.map((step, i) => (
              <div key={i} className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary mx-auto">
                  {step.number}
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link to="/dashboard">
              <Button variant="outline">Get Test Tokens</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Proof Section */}
      <section className="py-12 px-4 bg-secondary/20">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center space-y-6">
            {/* Demo GIF placeholder */}
            <div className="max-w-3xl mx-auto">
              <div className="aspect-video bg-secondary/50 border border-border/50 rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Demo GIF: Create Treasury → Deposit → Rebalance</p>
              </div>
            </div>
            
            {/* Trust links */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <a 
                href="https://github.com/vizzzix/arc_treasury"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <a 
                href="https://testnet.arcscan.app/address/0x0B7950Ec78d5f7B53B120c889F83a6bd1fB0da59"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View demo tx on ArcScan
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ - 4 questions */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-center mb-8">FAQ</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border border-border/50 rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline text-left">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="text-center mt-6">
            <Link to="/faq" className="text-sm text-primary hover:underline">
              View all FAQs →
            </Link>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-8 px-4 border-t border-border/50">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <div>© 2025 Arc Treasury. Built on Arc Network Testnet.</div>
            <div className="flex items-center gap-4">
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
