import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  define: {
    // Replace Node.js globals at build time — no runtime polyfill modules needed
    'global': 'globalThis',
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Resolve Node.js 'buffer' module to the npm polyfill package
      "buffer": path.resolve(__dirname, "node_modules/buffer/"),
    },
  },
  build: {
    modulePreload: {
      // Keep modulePreload for initial chunks but filter out solana
      resolveDependencies: (_filename, deps) =>
        deps.filter(dep => !dep.includes('solana') && !dep.includes('BridgeSolana') && !dep.includes('useBridgeSolana')),
    },
    // Optimize production bundle
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vite internal preload helper — force into its own tiny chunk
          // so it doesn't land in solana-vendor and pull 800KB into entry
          if (id.includes('vite/preload-helper')) {
            return 'preload';
          }
          // Buffer polyfill — keep separate from solana-vendor
          if (id.includes('node_modules/buffer/') || id.includes('node_modules/base64-js/') || id.includes('node_modules/ieee754/')) {
            return 'buffer-polyfill';
          }
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/viem/') || id.includes('node_modules/wagmi/') || id.includes('node_modules/@tanstack/react-query')) {
            return 'web3-vendor';
          }
          if (id.includes('node_modules/lucide-react/') || id.includes('node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }
          if (id.includes('node_modules/@solana/') || id.includes('node_modules/@solflare-wallet/') || id.includes('node_modules/@wallet-standard/')) {
            return 'solana-vendor';
          }
        },
      },
    },
  },
});
