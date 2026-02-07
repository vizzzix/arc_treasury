import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
import { ThemeProvider } from "next-themes";
import { config } from './lib/wagmi';
import { useReferralDetection } from './hooks/useReferralDetection';
import { StarField } from './components/StarField';
import { CircleWalletProvider } from './providers/CircleWalletProvider';

// Eagerly load landing page for fast initial render
import Landing from "./pages/Landing";

// Lazy load all other pages for code splitting
const DashboardSimplified = lazy(() => import("./pages/DashboardSimplified"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Profile = lazy(() => import("./pages/Profile"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Support = lazy(() => import("./pages/Support"));
const Litepaper = lazy(() => import("./pages/Litepaper"));
const LockDesignPreview = lazy(() => import("./pages/LockDesignPreview"));
const Swap = lazy(() => import("./pages/Swap"));
const PitchDeck = lazy(() => import("./pages/PitchDeck"));
const History = lazy(() => import("./pages/History"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Bridge pages: lazy-load WITH SolanaWalletProvider to defer ~2MB of Solana deps
const Bridge = lazy(async () => {
  const [{ default: BridgePage }, { SolanaWalletProvider }] = await Promise.all([
    import("./pages/Bridge"),
    import("./providers/SolanaWalletProvider"),
  ]);
  return { default: () => <SolanaWalletProvider><BridgePage /></SolanaWalletProvider> };
});

const BridgeSolana = lazy(async () => {
  const [{ default: BridgeSolanaPage }, { SolanaWalletProvider }] = await Promise.all([
    import("./pages/BridgeSolana"),
    import("./providers/SolanaWalletProvider"),
  ]);
  return { default: () => <SolanaWalletProvider><BridgeSolanaPage /></SolanaWalletProvider> };
});

const queryClient = new QueryClient();

// AppRoutes component with referral detection
const AppRoutes = () => {
  // Detect referral codes from URL and register referrals
  useReferralDetection();

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<DashboardSimplified />} />
          <Route path="/dashboard" element={<DashboardSimplified />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/bridge" element={<Bridge />} />
          <Route path="/support" element={<Support />} />
          <Route path="/litepaper" element={<Litepaper />} />
          <Route path="/lock-preview" element={<LockDesignPreview />} />
          <Route path="/swap" element={<Swap />} />
          <Route path="/bridge-solana" element={<BridgeSolana />} />
          <Route path="/pitch/:token" element={<PitchDeck />} />
          <Route path="/history" element={<History />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

const App = () => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <CircleWalletProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <StarField />
            <Toaster />
            <Sonner />
            <AppRoutes />
          </TooltipProvider>
        </ThemeProvider>
      </CircleWalletProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
