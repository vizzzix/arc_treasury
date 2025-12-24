import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Intercept fetch calls to Circle API and redirect through our proxy to avoid CORS
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Redirect Circle Iris API calls through our Vercel proxy
  if (url.includes('iris-api-sandbox.circle.com') || url.includes('iris-api.circle.com')) {
    const isTestnet = url.includes('sandbox');
    // Replace the Circle API URL with our proxy
    url = url.replace(
      isTestnet ? 'https://iris-api-sandbox.circle.com' : 'https://iris-api.circle.com',
      '/api/circle'
    );
    console.log('[Fetch Interceptor] Redirecting Circle API call to:', url);

    if (typeof input === 'string') {
      input = url;
    } else if (input instanceof URL) {
      input = new URL(url);
    } else {
      input = new Request(url, input);
    }
  }

  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
