import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WalletConnect } from "@/components/WalletConnect";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TREASURY_CONTRACTS, SUPPORTED_NETWORKS } from "@/lib/constants";
import arcLogo from "@/assets/arc-logo.png";

const FAQ = () => {
  const navigate = useNavigate();

  const faqs = [
    {
      question: "What is Arc Treasury?",
      answer:
        "A stablecoin yield vault on Arc Network. Deposit USDC or EURC and earn real-time yields backed by US Treasury bills via USYC.",
    },
    {
      question: "How does yield work?",
      answer:
        "Yield is generated through USYC — a tokenized money market fund backed by short-duration US Treasury bills. The APY is calculated from real-time USYC NAV prices. Locked positions earn boosted APY: +17% for 1 month, +35% for 3 months, +69% for 12 months.",
    },
    {
      question: "What are lock periods?",
      answer:
        "You can lock deposits for 1, 3, or 12 months to earn higher APY. Locked positions also earn bonus points multipliers (1.5x, 2x, 3x). Early withdrawal incurs a 25% penalty.",
    },
    {
      question: "How do I get USDC on Arc?",
      answer:
        "Use the built-in Bridge to transfer USDC from Ethereum Sepolia to Arc Testnet via Circle CCTP. Get testnet USDC from Circle Faucet first.",
    },
    {
      question: "What are Points?",
      answer:
        "Points are earned based on deposit amount and duration. Locked positions and NFT holders get multiplied rewards. Points may convert to future benefits.",
    },
    {
      question: "Is this live / real money?",
      answer:
        "No. This is a testnet deployment for demonstration purposes. All tokens are test tokens with no real value.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/30 sticky top-0 bg-background/80 backdrop-blur-lg z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="hover:bg-card"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <img src={arcLogo} alt="Arc Treasury" className="w-8 h-8" />
              <h1 className="text-2xl font-bold">Frequently Asked Questions</h1>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-bold mb-4">FAQ</h2>
            <p className="text-lg text-muted-foreground">
              Quick answers about Arc Treasury
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-border/50 rounded-xl px-6 bg-card hover:border-primary/30 transition-colors"
              >
                <AccordionTrigger className="text-left font-semibold hover:text-primary hover:no-underline py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Developer Info Section */}
          <section className="mt-12 pt-12 border-t border-border/30">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-semibold mb-6">Developer Information</h2>
              <Card className="p-6 border-border/50">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Deployed Contracts on Arc Testnet</h3>
                    <div className="space-y-2 text-sm font-mono">
                      <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span>TreasuryVault</span>
                        <a
                          href={`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${TREASURY_CONTRACTS.TreasuryVault}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {TREASURY_CONTRACTS.TreasuryVault.slice(0, 10)}...{TREASURY_CONTRACTS.TreasuryVault.slice(-8)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span>USYCOracle</span>
                        <a
                          href={`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${TREASURY_CONTRACTS.USYCOracle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {TREASURY_CONTRACTS.USYCOracle.slice(0, 10)}...{TREASURY_CONTRACTS.USYCOracle.slice(-8)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span>PointsMultiplierNFT</span>
                        <a
                          href={`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${TREASURY_CONTRACTS.PointsMultiplierNFT}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {TREASURY_CONTRACTS.PointsMultiplierNFT.slice(0, 10)}...{TREASURY_CONTRACTS.PointsMultiplierNFT.slice(-8)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/30">
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Testnet deployment. Yield simulated via USYC NAV oracle. Open source — MIT License.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open("https://github.com/vizzzix/arc_treasury", "_blank")}
                      >
                        GitHub
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default FAQ;
