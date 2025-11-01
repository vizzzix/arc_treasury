import { Card } from "@/components/ui/card";
import { TrendingUp, Activity, DollarSign, Fuel } from "lucide-react";
import StatCard from "@/components/StatCard";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useTreasury } from "@/contexts/TreasuryContext";

const Analytics = () => {
  const { totalYieldGenerated } = useTreasury();
  const transactions = [
    { type: "Rebalance", from: "USDC", to: "EURC", amount: "$5,420", time: "2 hours ago", status: "success" },
    { type: "Yield", from: "-", to: "USDC", amount: "$142", time: "5 hours ago", status: "success" },
    { type: "Rebalance", from: "EURC", to: "XSGD", amount: "$2,150", time: "1 day ago", status: "success" },
    { type: "Deposit", from: "-", to: "USDC", amount: "$50,000", time: "2 days ago", status: "success" },
    { type: "Rebalance", from: "XSGD", to: "USDC", amount: "$3,200", time: "3 days ago", status: "success" },
  ];

  const rebalanceHistory = [
    { date: "Jan 20", action: "USDC → EURC", amount: "$5,420", profit: "+$12" },
    { date: "Jan 18", action: "EURC → XSGD", amount: "$2,150", profit: "+$8" },
    { date: "Jan 15", action: "XSGD → USDC", amount: "$3,200", profit: "+$15" },
    { date: "Jan 12", action: "USDC → EURC", amount: "$4,800", profit: "+$18" },
  ];

  // Chart data
  const performanceData = [
    { month: "Jan", portfolio: 95, static: 92 },
    { month: "Feb", portfolio: 98, static: 93 },
    { month: "Mar", portfolio: 102, static: 94 },
    { month: "Apr", portfolio: 108, static: 95 },
    { month: "May", portfolio: 115, static: 96 },
    { month: "Jun", portfolio: 122, static: 97 },
  ];

  const allocationData = [
    { name: "USDC", value: 45, color: "hsl(var(--primary))" },
    { name: "EURC", value: 35, color: "hsl(var(--accent))" },
    { name: "XSGD", value: 20, color: "hsl(var(--success))" },
  ];

  const yieldData = [
    { month: "Jan", yield: 420 },
    { month: "Feb", yield: 580 },
    { month: "Mar", yield: 720 },
    { month: "Apr", yield: 890 },
    { month: "May", yield: 1050 },
    { month: "Jun", yield: 1240 },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">Track your treasury performance and history</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Profit"
            value={`$${parseFloat(totalYieldGenerated || "0").toLocaleString()}`}
            change="+12.4%"
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            title="Gas Spent"
            value="$23.45"
            icon={Fuel}
            trend="neutral"
          />
          <StatCard
            title="Rebalances"
            value="48"
            icon={Activity}
            trend="neutral"
          />
          <StatCard
            title="Net Profit"
            value="$8,210"
            change="+12.3%"
            icon={DollarSign}
            trend="up"
          />
        </div>

        {/* Performance Chart */}
        <Card className="modern-card p-8">
          <h2 className="text-xl font-bold mb-6">Performance Comparison</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="portfolio" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                name="Your Portfolio"
              />
              <Line 
                type="monotone" 
                dataKey="static" 
                stroke="hsl(var(--muted))" 
                strokeWidth={2}
                name="Static Holdings"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Allocation Pie Chart and Yield Bar Chart */}
        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="modern-card p-8">
            <h2 className="text-xl font-bold mb-6">Current Allocation</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="modern-card p-8">
            <h2 className="text-xl font-bold mb-6">Monthly Yield</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yieldData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                />
                <Bar dataKey="yield" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Rebalancing History */}
          <Card className="modern-card p-6">
            <h2 className="text-xl font-bold mb-6">Rebalancing History</h2>
            <div className="space-y-4">
              {rebalanceHistory.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors">
                  <div className="space-y-1">
                    <div className="font-medium">{item.action}</div>
                    <div className="text-sm text-muted-foreground">{item.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{item.amount}</div>
                    <div className="text-sm text-success">{item.profit}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Transaction History */}
          <Card className="modern-card p-6">
            <h2 className="text-xl font-bold mb-6">Recent Transactions</h2>
            <div className="space-y-4">
              {transactions.map((tx, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tx.type}</span>
                      {tx.from !== "-" && (
                        <span className="text-sm text-muted-foreground">
                          {tx.from} → {tx.to}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{tx.time}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{tx.amount}</div>
                    <div className="text-xs text-success">Success</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Gas vs Profit */}
        <Card className="modern-card p-8">
          <h2 className="text-xl font-bold mb-6">Gas Efficiency</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">Total Gas Spent</div>
              <div className="text-4xl font-bold text-warning">$23.45</div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-warning rounded-full" style={{ width: "15%" }} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">Total Profit Earned</div>
              <div className="text-4xl font-bold text-success">$8,234</div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{ width: "95%" }} />
              </div>
            </div>
          </div>
          <div className="mt-8 p-6 rounded-lg bg-gradient-to-r from-success/10 to-success/5 border border-success/20">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-2">Net Efficiency Ratio</div>
              <div className="text-5xl font-bold text-success">351x</div>
              <div className="text-sm text-muted-foreground mt-2">
                For every $1 spent on gas, you earned $351 in profit
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
