import { useState, useEffect, useCallback } from "react";
import { WalletHeader } from "@/components/WalletHeader";
import { ArrowLeft, Activity, TrendingUp, Users, ArrowRightLeft, Wallet, BarChart3, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useTVL } from "@/hooks/useTVL";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import arcLogo from "@/assets/arc-logo.webp";

interface ProtocolStats {
  totalBridgeVolume: number;
  totalBridgeTx: number;
  totalSwapVolume: number;
  totalSwapTx: number;
  totalLpVolume: number;
  totalLpTx: number;
  uniqueWallets: number;
  totalTransactions: number;
}

interface DailyActivity {
  date: string;
  bridges: number;
  swaps: number;
  lp: number;
  volume: number;
}

const MIN_AMOUNT = 1.0;

const formatUSD = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const formatNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
};

const shortenAddress = (addr: string): string =>
  `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const Analytics = () => {
  const navigate = useNavigate();
  const { tvl, totalUSDC, totalEURC, isLoading: tvlLoading } = useTVL();
  const { apy } = useUSYCPrice();
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [topWallets, setTopWallets] = useState<{ wallet_address: string; total_points: number; bridge_volume: number; swap_volume: number; }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!supabase) return;

    try {
      const [bridgeRes, bridgeCount, swapRes, swapCount, lpRes, lpCount, walletsRes, topRes] = await Promise.all([
        supabase.from('site_bridges').select('amount_usd').gte('amount_usd', MIN_AMOUNT),
        supabase.from('site_bridges').select('*', { count: 'exact', head: true }),
        supabase.from('swap_transactions').select('amount_usd').gte('amount_usd', MIN_AMOUNT),
        supabase.from('swap_transactions').select('*', { count: 'exact', head: true }),
        supabase.from('liquidity_events').select('amount_usd').gte('amount_usd', MIN_AMOUNT),
        supabase.from('liquidity_events').select('*', { count: 'exact', head: true }),
        supabase.from('user_points').select('wallet_address', { count: 'exact', head: true }).or('vault_volume.gt.0,swap_volume.gt.0,liquidity_volume.gt.0,bridge_volume.gt.0'),
        supabase.from('user_points').select('wallet_address, total_points, bridge_volume, swap_volume').gt('total_points', 0).order('total_points', { ascending: false }).limit(10),
      ]);

      const totalBridgeVolume = (bridgeRes.data || []).reduce((s, r) => s + Number(r.amount_usd), 0);
      const totalSwapVolume = (swapRes.data || []).reduce((s, r) => s + Number(r.amount_usd), 0);
      const totalLpVolume = (lpRes.data || []).reduce((s, r) => s + Number(r.amount_usd), 0);

      setStats({
        totalBridgeVolume,
        totalBridgeTx: bridgeCount.count || 0,
        totalSwapVolume,
        totalSwapTx: swapCount.count || 0,
        totalLpVolume,
        totalLpTx: lpCount.count || 0,
        uniqueWallets: walletsRes.count || 0,
        totalTransactions: (bridgeCount.count || 0) + (swapCount.count || 0) + (lpCount.count || 0),
      });

      setTopWallets(topRes.data || []);
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    }
  }, []);

  const fetchDailyActivity = useCallback(async () => {
    if (!supabase) return;

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [bridgeDaily, swapDaily, lpDaily] = await Promise.all([
        supabase.from('site_bridges').select('created_at, amount_usd').gte('created_at', thirtyDaysAgo).gte('amount_usd', MIN_AMOUNT).order('created_at', { ascending: true }),
        supabase.from('swap_transactions').select('created_at, amount_usd').gte('created_at', thirtyDaysAgo).gte('amount_usd', MIN_AMOUNT).order('created_at', { ascending: true }),
        supabase.from('liquidity_events').select('created_at, amount_usd').gte('created_at', thirtyDaysAgo).gte('amount_usd', MIN_AMOUNT).order('created_at', { ascending: true }),
      ]);

      const dayMap: Record<string, DailyActivity> = {};

      const toDay = (iso: string) => iso.slice(0, 10);

      (bridgeDaily.data || []).forEach(r => {
        const d = toDay(r.created_at);
        if (!dayMap[d]) dayMap[d] = { date: d, bridges: 0, swaps: 0, lp: 0, volume: 0 };
        dayMap[d].bridges++;
        dayMap[d].volume += Number(r.amount_usd);
      });

      (swapDaily.data || []).forEach(r => {
        const d = toDay(r.created_at);
        if (!dayMap[d]) dayMap[d] = { date: d, bridges: 0, swaps: 0, lp: 0, volume: 0 };
        dayMap[d].swaps++;
        dayMap[d].volume += Number(r.amount_usd);
      });

      (lpDaily.data || []).forEach(r => {
        const d = toDay(r.created_at);
        if (!dayMap[d]) dayMap[d] = { date: d, bridges: 0, swaps: 0, lp: 0, volume: 0 };
        dayMap[d].lp++;
        dayMap[d].volume += Number(r.amount_usd);
      });

      setDailyActivity(Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)));
    } catch (e) {
      console.error('Failed to fetch daily activity:', e);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchStats(), fetchDailyActivity()]).finally(() => setIsLoading(false));
  }, [fetchStats, fetchDailyActivity]);

  const netAPY = (apy * 0.95).toFixed(2);
  const maxVolume = dailyActivity.length > 0 ? Math.max(...dailyActivity.map(d => d.volume), 1) : 1;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute top-0 -right-40 w-80 h-80 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/20 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <div className="h-4 w-px bg-border/30" />
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h1 className="text-lg font-semibold">Protocol Analytics</h1>
              </div>
            </div>
            <WalletHeader />
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-20 container mx-auto px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Header */}
          <div className="text-center space-y-3">
            <img src={arcLogo} alt="Arc Treasury" className="w-12 h-12 mx-auto" />
            <h2 className="text-3xl font-bold">Arc Treasury Analytics</h2>
            <p className="text-muted-foreground">Real-time protocol metrics on Arc Testnet</p>
          </div>

          {/* Top Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Total Value Locked"
              value={tvlLoading ? "..." : formatUSD(tvl)}
              color="text-green-400"
              bgColor="bg-green-500/10"
            />
            <StatCard
              icon={<Activity className="w-5 h-5" />}
              label="Net APY"
              value={`${netAPY}%`}
              color="text-yellow-400"
              bgColor="bg-yellow-500/10"
            />
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Active Wallets"
              value={isLoading ? "..." : formatNumber(stats?.uniqueWallets || 0)}
              color="text-blue-400"
              bgColor="bg-blue-500/10"
            />
            <StatCard
              icon={<ArrowRightLeft className="w-5 h-5" />}
              label="Total Transactions"
              value={isLoading ? "..." : formatNumber(stats?.totalTransactions || 0)}
              color="text-purple-400"
              bgColor="bg-purple-500/10"
            />
          </div>

          {/* Volume Breakdown */}
          <div className="grid md:grid-cols-3 gap-4">
            <VolumeCard
              title="Bridge Volume"
              volume={stats?.totalBridgeVolume || 0}
              txCount={stats?.totalBridgeTx || 0}
              color="text-cyan-400"
              borderColor="border-cyan-500/20"
              isLoading={isLoading}
            />
            <VolumeCard
              title="Swap Volume"
              volume={stats?.totalSwapVolume || 0}
              txCount={stats?.totalSwapTx || 0}
              color="text-indigo-400"
              borderColor="border-indigo-500/20"
              isLoading={isLoading}
            />
            <VolumeCard
              title="Liquidity Volume"
              volume={stats?.totalLpVolume || 0}
              txCount={stats?.totalLpTx || 0}
              color="text-emerald-400"
              borderColor="border-emerald-500/20"
              isLoading={isLoading}
            />
          </div>

          {/* TVL Composition */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              TVL Composition
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-white/5">
                <div className="text-2xl font-bold text-green-400">{tvlLoading ? "..." : formatUSD(totalUSDC)}</div>
                <div className="text-xs text-muted-foreground mt-1">USDC (flex + locked)</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/5">
                <div className="text-2xl font-bold text-blue-400">{tvlLoading ? "..." : formatUSD(totalEURC)}</div>
                <div className="text-xs text-muted-foreground mt-1">EURC</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/5">
                <div className="text-2xl font-bold text-yellow-400">{netAPY}%</div>
                <div className="text-xs text-muted-foreground mt-1">Current APY</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/5">
                <div className="text-2xl font-bold text-purple-400">{tvlLoading ? "..." : formatUSD(tvl)}</div>
                <div className="text-xs text-muted-foreground mt-1">Total TVL (USD)</div>
              </div>
            </div>
          </div>

          {/* Daily Activity Chart (simple bar chart) */}
          {dailyActivity.length > 0 && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Daily Volume (Last 30 Days)
              </h3>
              <div className="flex items-end gap-1" style={{ height: '160px' }}>
                {dailyActivity.map((day) => {
                  const heightPx = Math.max(Math.round((day.volume / maxVolume) * 156), 3);
                  const total = day.bridges + day.swaps + day.lp;
                  return (
                    <div key={day.date} className="flex-1 relative group" style={{ height: '160px' }}>
                      <div className="absolute bottom-0 left-0 right-0 hidden group-hover:block z-10" style={{ bottom: `${heightPx + 8}px` }}>
                        <div className="border border-white/10 rounded-lg p-2 text-xs whitespace-nowrap shadow-xl" style={{ background: '#1a1a28' }}>
                          <div className="font-semibold">{day.date}</div>
                          <div className="text-muted-foreground">{formatUSD(day.volume)} · {total} txs</div>
                          {day.bridges > 0 && <div className="text-cyan-400">{day.bridges} bridges</div>}
                          {day.swaps > 0 && <div className="text-indigo-400">{day.swaps} swaps</div>}
                          {day.lp > 0 && <div className="text-emerald-400">{day.lp} LP</div>}
                        </div>
                      </div>
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t bg-gradient-to-t from-primary/60 to-primary/30 hover:from-primary/80 hover:to-primary/50 transition-all cursor-pointer"
                        style={{ height: `${heightPx}px` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{dailyActivity[0]?.date}</span>
                <span>{dailyActivity[dailyActivity.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Top Users */}
          {topWallets.length > 0 && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Top Users by Points
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-xs uppercase">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">Wallet</th>
                      <th className="text-right py-2 px-3">Points</th>
                      <th className="text-right py-2 px-3">Bridge Vol</th>
                      <th className="text-right py-2 px-3">Swap Vol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topWallets.map((w, i) => (
                      <tr key={w.wallet_address} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 font-medium text-muted-foreground">{i + 1}</td>
                        <td className="py-3 px-3 font-mono text-xs">
                          <a
                            href={`https://testnet.arcscan.app/address/${w.wallet_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {shortenAddress(w.wallet_address)}
                          </a>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-yellow-400">{w.total_points.toFixed(1)}</td>
                        <td className="py-3 px-3 text-right text-muted-foreground">{formatUSD(w.bridge_volume)}</td>
                        <td className="py-3 px-3 text-right text-muted-foreground">{formatUSD(w.swap_volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Protocol Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <h3 className="font-semibold mb-3">Smart Contracts</h3>
              <div className="space-y-2 text-sm">
                <ContractLink label="TreasuryVault (V14)" address="0x17ca5232415430bC57F646A72fD15634807bF729" />
                <ContractLink label="StablecoinSwapV2" address="0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf" />
                <ContractLink label="EarlySupporterBadge" address="0xb26a5b1d783646a7236ca956f2e954e002bf8d13" />
                <ContractLink label="USYCOracle" address="0xfe51166b831cd55737a1e1231a811ada0d7b3378" />
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <h3 className="font-semibold mb-3">Circle Integration</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> USDC — Native gas token (18 dec)</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> CCTP V2 — Sepolia &harr; Arc bridge</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> Programmable Wallets — Google OAuth</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> Gateway — Webhook notifications</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-white/5">
            <p>Arc Treasury &middot; Arc Testnet (Chain ID 5042002) &middot; Data updates every 2 minutes</p>
            <p className="mt-1">
              <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Explorer</a>
              {" · "}
              <a href="/litepaper" className="text-primary hover:underline">Litepaper</a>
              {" · "}
              <a href="/faq" className="text-primary hover:underline">FAQ</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

const StatCard = ({ icon, label, value, color, bgColor }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}) => (
  <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
    <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center ${color} mb-3`}>
      {icon}
    </div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    <div className="text-xs text-muted-foreground mt-1">{label}</div>
  </div>
);

const VolumeCard = ({ title, volume, txCount, color, borderColor, isLoading }: {
  title: string;
  volume: number;
  txCount: number;
  color: string;
  borderColor: string;
  isLoading: boolean;
}) => (
  <div className={`p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border ${borderColor} backdrop-blur-sm`}>
    <div className="text-sm text-muted-foreground mb-2">{title}</div>
    <div className={`text-2xl font-bold ${color}`}>{isLoading ? "..." : formatUSD(volume)}</div>
    <div className="text-xs text-muted-foreground mt-1">{isLoading ? "..." : `${formatNumber(txCount)} transactions`}</div>
  </div>
);

const ContractLink = ({ label, address }: { label: string; address: string }) => (
  <div className="flex justify-between items-center">
    <span className="text-muted-foreground">{label}</span>
    <a
      href={`https://testnet.arcscan.app/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline font-mono text-xs"
    >
      {shortenAddress(address)}
    </a>
  </div>
);

export default Analytics;
