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
      category: "About Arc Treasury",
      items: [
        {
          question: "What is Arc Treasury and how does yield work?",
          answer: `Arc Treasury is a yield vault built on Circle's Arc blockchain. You deposit USDC, we convert it to USYC (tokenized US Treasury Bills by Hashnote), and you earn ~${apy.toFixed(1)}% APY — the same rate as the Federal Reserve. USYC price grows daily from T-Bill returns, and you can redeem to USDC anytime.`,
        },
        {
          question: "Why use Arc Treasury instead of accessing USYC directly?",
          answer: `Direct USYC access requires institutional investor status, KYC/AML verification, a $100,000 minimum investment, and wallet allowlisting. Arc Treasury removes all these barriers — any USDC holder can access T-Bill yields through our vault with no minimum deposit.`,
        },
        {
          question: "What are the fees?",
          answer: `Arc Treasury charges 5% of yield only — you keep 95% of all earnings. There are no deposit fees, no withdrawal fees, and no hidden costs. USYC itself has a 0.1% redemption fee on mainnet.`,
        },
      ],
    },
    {
      category: "Deposits & Positions",
      items: [
        {
          question: "What's the difference between Flexible and Locked deposits?",
          answer: `Both earn the same ~${apy.toFixed(1)}% APY. Flexible deposits can be withdrawn anytime. Locked deposits (1, 3, or 12 months) earn bonus Points with multipliers: 1.5x for 1 month, 2x for 3 months, 3x for 12 months. Early unlock incurs a 25% points penalty.`,
        },
        {
          question: "How do I get testnet USDC to try the platform?",
          answer: "Visit faucet.circle.com and select Arc Testnet to request free testnet USDC. Alternatively, you can bridge USDC from Ethereum Sepolia using our Bridge feature.",
        },
      ],
    },
    {
      category: "Points & Rewards",
      items: [
        {
          question: "How do Points work and what are they worth?",
          answer: "Points are calculated as: Deposit Amount × Days Held × Lock Multiplier. Flexible deposits earn 1x, while locked positions earn 1.5x (1M), 2x (3M), or 3x (12M). Points will convert to ARC token rewards at mainnet launch — early users get the best rates.",
        },
        {
          question: "What is the Early Supporter Badge?",
          answer: "A free NFT available to the first 5,000 users who deposit $10 or more. Mint it on the /rewards page. The badge provides a permanent 1.2x multiplier on all future points earnings, stacking with lock multipliers.",
        },
      ],
    },
    {
      category: "Testnet & Mainnet",
      items: [
        {
          question: "How does the testnet work and what changes on mainnet?",
          answer: "On testnet, yield is simulated using a USDC reserve pool that mirrors mainnet APY rates. The user experience is identical to mainnet. On mainnet launch: real USYC conversion, actual T-Bill yield, institutional-grade security. All testnet balances are for testing only — mainnet will require fresh deposits with real assets.",
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
