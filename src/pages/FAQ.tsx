import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { TREASURY_CONTRACTS, SUPPORTED_NETWORKS } from "@/lib/constants";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import arcLogo from "@/assets/arc-logo.png";

const FAQ = () => {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const { apy } = useUSYCPrice();

  const faqs = [
    {
      category: "About",
      items: [
        {
          question: "What is Arc Treasury?",
          answer: `Yield vault on Arc Testnet. Deposit USDC/EURC → earn ~${apy.toFixed(1)}% APY from US Treasury Bills via USYC (Hashnote). Testnet tokens have no real value.`,
        },
        {
          question: "How does the yield work?",
          answer: `Your stablecoins convert to USYC (tokenized T-Bills). USYC price grows daily from T-Bill returns. APY is variable (~${apy.toFixed(2)}% net after fees).`,
        },
        {
          question: "What are the fees?",
          answer: "Arc Treasury: 5% of yield only. USYC: 0.1% redemption + 10% performance fee. No deposit/withdrawal fees.",
        },
      ],
    },
    {
      category: "Deposits & Locks",
      items: [
        {
          question: "Flexible vs Locked deposits?",
          answer: "Same APY for both. Locked deposits earn bonus Points (1.5x/2x/3x multiplier). Early unlock = 25% penalty. Flexible = withdraw anytime.",
        },
        {
          question: "How to get testnet USDC?",
          answer: "faucet.circle.com → Arc Testnet → request USDC. Or bridge from Sepolia via /bridge page.",
        },
      ],
    },
    {
      category: "Points & Rewards",
      items: [
        {
          question: "How do Points work?",
          answer: "Points = Deposit × Days × Multiplier. Flex=1x, 1M=1.5x, 3M=2x, 12M=3x. Points → future ARC token rewards.",
        },
        {
          question: "What is Early Supporter Badge?",
          answer: "Free NFT for first 5,000 users. Deposit $10+ → mint on /rewards. Gives permanent 1.2x points boost!",
        },
      ],
    },
    {
      category: "Testnet Mode",
      items: [
        {
          question: "How does yield work on testnet?",
          answer: "On testnet, we simulate USYC yield due to Hashnote Teller limitations (90 USDC daily limit, ~10% testnet fee). Instead of real USYC conversion, the vault accrues yield from a USDC reserve pool at the same APY rate. Your experience mirrors mainnet behavior.",
        },
        {
          question: "Why not use real USYC on testnet?",
          answer: "Hashnote's testnet Teller has strict limits: 90 USDC/day max conversion, ~10% conversion fee (vs 0% on mainnet). This makes real conversion impractical for testing. We simulate yield to let you test the full deposit/withdraw/yield flow.",
        },
        {
          question: "Will mainnet be different?",
          answer: "Yes! On mainnet: real USYC conversion (0% mint fee, 0.1% redeem fee), actual T-Bill yield, no conversion limits. The yield simulation is testnet-only to provide a realistic testing experience.",
        },
        {
          question: "Is my testnet balance real?",
          answer: "No. All tokens on Arc Testnet (USDC, EURC, shares, points) have no real value. This is for testing only. Mainnet launch will require fresh deposits with real assets.",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute top-0 -right-40 w-80 h-80 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/2 w-80 h-80 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
      </div>

      {/* Header */}
      <header className="border-b border-border/20 sticky top-0 bg-background/60 backdrop-blur-xl z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <img src={arcLogo} alt="Arc Treasury" className="w-8 h-8" />
              <h1 className="text-2xl font-bold">FAQ</h1>
            </div>
            <div className="flex items-center gap-3">
              {isConnected ? <UserMenu /> : <WalletConnect />}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {faqs.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mb-10">
              <h2 className="text-lg font-semibold text-primary mb-4">{section.category}</h2>
              <Accordion type="single" collapsible className="space-y-3">
                {section.items.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`section-${sectionIndex}-item-${index}`}
                    className="border border-white/10 rounded-2xl px-5 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm hover:border-primary/30 transition-all duration-300"
                  >
                    <AccordionTrigger className="text-left font-medium hover:text-primary hover:no-underline py-5 text-sm">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm pb-5">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}

          {/* Contracts Section */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <h2 className="text-lg font-semibold text-primary mb-4">Contracts (Arc Testnet)</h2>
            <div className="rounded-2xl p-5 bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <div className="space-y-3 text-sm font-mono">
                {[
                  { name: "TreasuryVault", address: TREASURY_CONTRACTS.TreasuryVault },
                  { name: "EarlySupporterBadge", address: TREASURY_CONTRACTS.EarlySupporterBadge },
                  { name: "USYCOracle", address: TREASURY_CONTRACTS.USYCOracle },
                ].map((contract) => (
                  <div key={contract.name} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-primary/20 transition-colors">
                    <span className="text-muted-foreground">{contract.name}</span>
                    <a
                      href={`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${contract.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-white/10 flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://github.com/vizzzix/arc_treasury", "_blank")}
                  className="border-white/10 hover:bg-white/5 hover:border-primary/30"
                >
                  GitHub
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://x.com/arctreasury", "_blank")}
                  className="border-white/10 hover:bg-white/5 hover:border-primary/30"
                >
                  Twitter
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FAQ;
