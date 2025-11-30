import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
import { ThemeProvider } from "next-themes";
import { config } from './lib/wagmi';
import { useReferralDetection } from './hooks/useReferralDetection';
import Landing from "./pages/Landing";
import DashboardSimplified from "./pages/DashboardSimplified";
import FAQ from "./pages/FAQ";
import Bridge from "./pages/Bridge";
import Profile from "./pages/Profile";
import Rewards from "./pages/Rewards";
import Support from "./pages/Support";
import Litepaper from "./pages/Litepaper";
import LockDesignPreview from "./pages/LockDesignPreview";
import Swap from "./pages/Swap";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// AppRoutes component with referral detection
const AppRoutes = () => {
  // Detect referral codes from URL and register referrals
  useReferralDetection();

  return (
    <BrowserRouter>
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
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
