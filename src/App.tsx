import { Suspense, lazy, type ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
import { ThemeProvider } from "next-themes";
import * as Sentry from '@sentry/react';
import { config } from './lib/wagmi';
import { useReferralDetection } from './hooks/useReferralDetection';
import { StarField } from './components/StarField';
import { CircleWalletProvider } from './providers/CircleWalletProvider';
import { PageTransition } from './components/PageTransition';

// Eagerly load landing page for fast initial render
import Landing from "./pages/Landing";

// Retry dynamic import on failure (handles stale chunks after deploy)
function lazyRetry(factory: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(() =>
    factory().catch(() => {
      window.location.reload();
      return new Promise(() => {}); // never resolves — page will reload
    })
  );
}

// Lazy load all other pages for code splitting
const DashboardSimplified = lazyRetry(() => import("./pages/DashboardSimplified"));
const FAQ = lazyRetry(() => import("./pages/FAQ"));
const Profile = lazyRetry(() => import("./pages/Profile"));
const Rewards = lazyRetry(() => import("./pages/Rewards"));
const Support = lazyRetry(() => import("./pages/Support"));
const Litepaper = lazyRetry(() => import("./pages/Litepaper"));
const Swap = lazyRetry(() => import("./pages/Swap"));
const History = lazyRetry(() => import("./pages/History"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

// Bridge pages: lazy-load WITH SolanaWalletProvider to defer ~2MB of Solana deps
const Bridge = lazy(async () => {
  try {
    const [{ default: BridgePage }, { SolanaWalletProvider }] = await Promise.all([
      import("./pages/Bridge"),
      import("./providers/SolanaWalletProvider"),
    ]);
    return { default: () => <SolanaWalletProvider><BridgePage /></SolanaWalletProvider> };
  } catch {
    window.location.reload();
    return new Promise(() => {});
  }
});

const BridgeSolana = lazy(async () => {
  try {
    const [{ default: BridgeSolanaPage }, { SolanaWalletProvider }] = await Promise.all([
      import("./pages/BridgeSolana"),
      import("./providers/SolanaWalletProvider"),
    ]);
    return { default: () => <SolanaWalletProvider><BridgeSolanaPage /></SolanaWalletProvider> };
  } catch {
    window.location.reload();
    return new Promise(() => {});
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// AppRoutes component with referral detection
const AppRoutes = () => {
  // Detect referral codes from URL and register referrals
  useReferralDetection();

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex flex-col items-center justify-center min-h-screen gap-3"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /><p className="text-sm text-muted-foreground animate-pulse">Loading...</p></div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<PageTransition><DashboardSimplified /></PageTransition>} />
          <Route path="/dashboard" element={<PageTransition><DashboardSimplified /></PageTransition>} />
          <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
          <Route path="/rewards" element={<PageTransition><Rewards /></PageTransition>} />
          <Route path="/faq" element={<PageTransition><FAQ /></PageTransition>} />
          <Route path="/bridge" element={<PageTransition><Bridge /></PageTransition>} />
          <Route path="/support" element={<PageTransition><Support /></PageTransition>} />
          <Route path="/litepaper" element={<PageTransition><Litepaper /></PageTransition>} />
          <Route path="/swap" element={<PageTransition><Swap /></PageTransition>} />
          <Route path="/bridge-solana" element={<PageTransition><BridgeSolana /></PageTransition>} />
          <Route path="/history" element={<PageTransition><History /></PageTransition>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

const SentryErrorFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
    <h1 className="text-2xl font-bold">Something went wrong</h1>
    <p className="text-muted-foreground">An unexpected error occurred. Please refresh the page.</p>
    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
      Refresh
    </button>
  </div>
);

const App = () => (
  <Sentry.ErrorBoundary fallback={<SentryErrorFallback />}>
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
  </Sentry.ErrorBoundary>
);

export default App;
