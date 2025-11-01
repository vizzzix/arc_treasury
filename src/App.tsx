import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import CreateTreasury from "./pages/CreateTreasury";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import Navbar from "./components/Navbar";
import { WalletProvider } from "./contexts/WalletContext";
import { TreasuryProvider } from "./contexts/TreasuryContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WalletProvider>
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
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
        </TreasuryProvider>
      </WalletProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
