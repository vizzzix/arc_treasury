import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, ExternalLink } from "lucide-react";

const FAQ = () => {
  const faqs = [
    {
      id: "what-is",
      question: "What is Arc Treasury?",
      answer: "Arc Treasury is a sophisticated treasury-management platform built on the Arc Network. It enables automated allocation, yield generation, and portfolio rebalancing of stablecoins (USDC, EURC, XSGD) through a single, intuitive interface."
    },
    {
      id: "vs-aave-compound",
      question: "How does Arc Treasury differ from simply using a protocol like Aave or Compound?",
      answer: "While protocols such as Aave or Compound allow you to deposit individual stablecoins, Arc Treasury offers a unified solution: Multi-asset treasury management (one dashboard), automated rebalancing based on defined strategies (Conservative / Balanced / Aggressive), built-in referral & rewards system, and transaction fees denominated in USDC (leveraging Arc Network's stablecoin-first design). Together, these features offer a streamlined and scalable experience for DAOs, fintech enterprises, and stablecoin investors."
    },
    {
      id: "yield-source",
      question: "Where does the yield (return) come from currently?",
      answer: "On the Arc Testnet, yield is simulated via our internal YieldAggregator contract according to a predefined APY model. This enables testing of all treasury mechanics. In a future production deployment, the platform will integrate real-world yield sources (such as Aave, Compound or other ERC-4626 compliant vaults)."
    },
    {
      id: "supported-stablecoins",
      question: "Why only USDC, EURC, and XSGD?",
      answer: "These three stablecoins provide optimal regional diversification: USDC represents the US Dollar (global reserve currency), EURC covers the European market, and XSGD serves the Asia-Pacific region. This combination enables treasuries to maintain balanced exposure across major economic zones.\n\nArc Network's stablecoin-first design with USDC as the native gas token makes it the natural anchor for multi-currency treasury operations. The platform architecture is built specifically for seamless stablecoin swaps and rebalancing.\n\nFor the testnet phase, we focus on these three to validate core mechanics. Production deployment will evaluate additional stablecoins (USDT, DAI, etc.) based on liquidity, regulatory clarity, and community demand."
    },
    {
      id: "why-arc",
      question: "Why choose the Arc Network?",
      answer: "The Arc Network provides a stablecoin-native blockchain environment — fees are paid in USDC, transactions finalize in under a second, and the EVM-compatible architecture supports familiar development workflows. These characteristics make Arc an ideal foundation for treasury and stablecoin finance applications."
    },
    {
      id: "real-money",
      question: "Is this real money?",
      answer: "Currently, Arc Treasury is live on the Arc Testnet and uses mock tokens for development and demonstration purposes only. Full production deployment with real assets will proceed once all security audits and integrations are complete."
    },
    {
      id: "target-users",
      question: "Who is this platform designed for?",
      answer: "Arc Treasury is designed for: DAOs and organizations managing reserves in stablecoins, fintech companies seeking programmable treasury infrastructure, and crypto-native users aiming for a hands-off approach to stablecoin portfolio management. It delivers an enterprise-grade experience with the simplicity of consumer-grade UX."
    }
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 mb-4">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold gradient-text">Frequently Asked Questions</h1>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about Arc Treasury
          </p>
        </div>

        {/* FAQ Accordion */}
        <Card className="modern-card p-6">
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, index) => (
              <div key={faq.id}>
                <AccordionItem value={faq.id} className="border-none">
                  <AccordionTrigger className="hover:no-underline hover:bg-secondary/50 px-4 py-3 rounded-lg transition-colors">
                    <span className="text-left font-semibold">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4 text-muted-foreground whitespace-pre-line">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
                {index < faqs.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </Accordion>
        </Card>
      </div>
    </div>
  );
};

export default FAQ;

