import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Github, ExternalLink, Sparkles, LineChart, LayoutGrid } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
      <section className="w-full">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-10 text-center">
          <p className="text-xs tracking-wide text-sub mb-4">
            Arc Testnet • USDC gas • Sub-second finality
          </p>
          
          <h1 
            className="font-semibold leading-tight mx-auto"
            style={{ fontSize: "clamp(28px, 6vw, 48px)" }}
          >
            Stablecoin Treasury on Arc
          </h1>
          
          <p 
            className="mx-auto max-w-3xl mt-3 text-sub"
            style={{ fontSize: "clamp(14px, 2vw, 18px)" }}
          >
            AI allocations and automated rebalancing for USDC/EURC/XSGD — all in one dashboard.
          </p>
          
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/dashboard">
              <Button className="px-5 h-10 rounded-xl gap-2">
                Launch App
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <a href="https://docs.arc.network" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="px-5 h-10 rounded-xl border gap-2">
                <BookOpen className="w-3.5 h-3.5" />
                View Docs
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Value Cards */}
      <section className="mx-auto max-w-5xl px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {valueProps.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-transparent hover:border-white/20 transition-colors p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 opacity-80" />
                <h3 className="font-medium">{title}</h3>
              </div>
              <p className="text-sm text-sub">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-xl font-semibold text-center mb-8">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {steps.map((step, i) => (
            <div key={i} className="text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-base font-semibold text-primary mx-auto">
                {step.number}
              </div>
              <h3 className="font-medium text-sm">{step.title}</h3>
              <p className="text-xs text-sub">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="rounded-xl">
              Get Test Tokens
            </Button>
          </Link>
        </div>
      </section>

      {/* Proof Section */}
      <section className="mx-auto max-w-5xl px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-6 text-sm">
          <a 
            className="opacity-80 hover:opacity-100 underline-offset-4 hover:underline flex items-center gap-1.5" 
            href="https://github.com/vizzzix/arc_treasury" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Github className="w-3.5 h-3.5" />
            GitHub
          </a>
          <a 
            className="opacity-80 hover:opacity-100 underline-offset-4 hover:underline flex items-center gap-1.5" 
            href="https://testnet.arcscan.app/address/0x0B7950Ec78d5f7B53B120c889F83a6bd1fB0da59" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View demo tx on ArcScan
          </a>
        </div>
      </section>

      {/* FAQ - 4 questions */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-xl font-semibold text-center mb-8">FAQ</h2>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem 
              key={i} 
              value={`item-${i}`} 
              className="border border-border rounded-xl px-4"
            >
              <AccordionTrigger className="hover:no-underline text-left text-sm font-medium">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sub text-sm">
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
      </section>

      {/* Minimal Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-sub">
            <div>© 2025 Arc Treasury. Built on Arc Network Testnet.</div>
            <div className="flex items-center gap-4">
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
