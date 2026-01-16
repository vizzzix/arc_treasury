import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Intercept fetch calls to Circle API and redirect through our proxy to avoid CORS
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Redirect Circle Iris API calls through our Vercel proxy
  if (url.includes('iris-api-sandbox.circle.com') || url.includes('iris-api.circle.com')) {
    // Parse the URL to extract path and query params
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Handle fees endpoint: /v2/burn/USDC/fees/{destDomain}/{srcDomain}
    const feesMatch = path.match(/\/v2\/burn\/USDC\/fees\/(\d+)\/(\d+)/);
    if (feesMatch) {
      url = `/api/circle?action=fees&destDomain=${feesMatch[1]}&srcDomain=${feesMatch[2]}`;
    }

    // Handle messages endpoint: /v2/messages/{domain}?transactionHash=...
    const messagesMatch = path.match(/\/v2\/messages\/(\d+)/);
    if (messagesMatch) {
      const transactionHash = urlObj.searchParams.get('transactionHash');
      url = `/api/circle?action=messages&domain=${messagesMatch[1]}&transactionHash=${transactionHash}`;
    }

    if (typeof input === 'string') {
      input = url;
    } else if (input instanceof URL) {
      input = new URL(url, window.location.origin);
    } else {
      input = new Request(url, input);
    }
  }

  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
