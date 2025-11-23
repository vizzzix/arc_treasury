import { useState } from "react";
import { LockPeriodSelector, LockPeriod } from "@/components/LockPeriodSelector";
import { LockedPositionCard } from "@/components/LockedPositionCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LockDesignPreview = () => {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState<LockPeriod>(
    LockPeriod.THREE_MONTH
  );
  const [depositAmount, setDepositAmount] = useState(50000);

  // Mock positions for demo
  const mockPositions = [
    {
      id: "0x1a2b3c4d",
      amount: 100000,
      token: "USDC" as const,
      lockPeriod: LockPeriod.TWELVE_MONTH,
      depositTime: new Date("2024-11-20"),
      unlockTime: new Date("2025-11-20"),
      currentAPY: 6.5,
      earnedYield: 3245.67,
    },
    {
      id: "0x5e6f7g8h",
      amount: 50000,
      token: "EURC" as const,
      lockPeriod: LockPeriod.THREE_MONTH,
      depositTime: new Date("2024-12-15"),
      unlockTime: new Date("2025-03-15"),
      currentAPY: 5.2,
      earnedYield: 856.32,
    },
    {
      id: "0x9i0j1k2l",
      amount: 25000,
      token: "USDC" as const,
      lockPeriod: LockPeriod.ONE_MONTH,
      depositTime: new Date("2025-01-10"),
      unlockTime: new Date("2025-01-22"),
      currentAPY: 4.5,
      earnedYield: 123.45,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate("/")}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <h1 className="text-xl font-bold">Lock Feature Design Preview</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 container mx-auto px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Section 1: Lock Period Selector */}
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">1. Lock Period Selector</h2>
              <p className="text-muted-foreground">
                Component for choosing lock period during deposit
              </p>
            </div>

            <div className="max-w-4xl p-8 rounded-xl border border-border/50 bg-card/50">
              {/* Deposit Amount Input for Demo */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Deposit Amount (for yield calculation demo)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground"
                  placeholder="Enter amount"
                />
              </div>

              <LockPeriodSelector
                selected={selectedPeriod}
                onSelect={setSelectedPeriod}
                baseAPY={3.85}
                depositAmount={depositAmount}
              />
            </div>
          </section>

          {/* Section 2: Locked Position Cards */}
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                2. Locked Position Cards
              </h2>
              <p className="text-muted-foreground">
                Cards showing user's locked positions on dashboard
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockPositions.map((position) => (
                <LockedPositionCard
                  key={position.id}
                  position={position}
                  onWithdraw={(id) => console.log("Withdraw position:", id)}
                  onClaimYield={(id) => console.log("Claim yield:", id)}
                />
              ))}
            </div>
          </section>

          {/* Section 3: Modal Preview */}
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                3. Deposit Modal Preview
              </h2>
              <p className="text-muted-foreground">
                How it will look in the deposit modal
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-6 shadow-2xl">
                <h3 className="text-xl font-bold mb-4">Deposit USDC</h3>

                {/* Amount Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-lg"
                      placeholder="0.00"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                      USDC
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Available: $125,000.00
                  </p>
                </div>

                {/* Lock Period Selector */}
                <LockPeriodSelector
                  selected={selectedPeriod}
                  onSelect={setSelectedPeriod}
                  baseAPY={3.85}
                  depositAmount={depositAmount}
                />

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" className="flex-1">
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-primary hover:bg-primary/90">
                    Deposit & Lock
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Dashboard Layout Preview */}
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                4. Dashboard Layout Preview
              </h2>
              <p className="text-muted-foreground">
                How locked positions will appear on the main dashboard
              </p>
            </div>

            <div className="space-y-6">
              {/* Flexible Balance Section */}
              <div className="p-6 rounded-xl border border-border/50 bg-card/50">
                <h3 className="text-lg font-semibold mb-4">Flexible Balance</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-background/60 border border-border/40">
                    <span className="text-sm text-muted-foreground">USDC</span>
                    <p className="text-2xl font-bold mt-1">$25,000</p>
                    <span className="text-xs text-green-500">3.85% APY</span>
                  </div>
                  <div className="p-4 rounded-lg bg-background/60 border border-border/40">
                    <span className="text-sm text-muted-foreground">EURC</span>
                    <p className="text-2xl font-bold mt-1">€18,500</p>
                    <span className="text-xs text-green-500">3.85% APY</span>
                  </div>
                </div>
              </div>

              {/* Locked Positions Section */}
              <div className="p-6 rounded-xl border border-border/50 bg-card/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Locked Positions</h3>
                  <span className="text-sm text-muted-foreground">
                    3 active locks
                  </span>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mockPositions.map((position) => (
                    <LockedPositionCard
                      key={position.id}
                      position={position}
                      onWithdraw={(id) => console.log("Withdraw:", id)}
                      onClaimYield={(id) => console.log("Claim:", id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Design Notes */}
          <section className="p-6 rounded-xl border border-primary/30 bg-primary/5">
            <h3 className="text-lg font-semibold mb-3">Design Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Consistent with existing design system (shadcn/ui)</li>
              <li>✓ Clear visual hierarchy for lock options</li>
              <li>✓ Real-time countdown for locked positions</li>
              <li>✓ Color-coded status (locked/unlocked)</li>
              <li>✓ APY breakdown showing base + boost</li>
              <li>✓ Expected yield calculations</li>
              <li>✓ Progress bars for lock duration</li>
              <li>✓ Responsive grid layouts</li>
              <li>✓ Hover states and transitions</li>
              <li>✓ Accessible button states (disabled when locked)</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LockDesignPreview;
