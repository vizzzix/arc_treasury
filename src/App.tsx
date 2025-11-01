import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import CreateTreasury from "./pages/CreateTreasury";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Referrals from "./pages/Referrals";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";
import Navbar from "./components/Navbar";
import { WalletProvider } from "./contexts/WalletContext";
import { TreasuryProvider } from "./contexts/TreasuryContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PointsProvider } from "./contexts/PointsContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <WalletProvider>
          <PointsProvider>
            <TreasuryProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Navbar />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/create" element={<CreateTreasury />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/faq" element={<FAQ />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
            </TreasuryProvider>
          </PointsProvider>
        </WalletProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
