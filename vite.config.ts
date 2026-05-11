import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
        })]
      : []),
  ],
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
    sourcemap: !!process.env.SENTRY_AUTH_TOKEN,
    modulePreload: {
      // Keep modulePreload for initial chunks but filter out solana
      resolveDependencies: (_filename, deps) =>
        deps.filter(dep =>
          !dep.includes('solana') &&
          !dep.includes('BridgeSolana') &&
          !dep.includes('useBridgeSolana')
        ),
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
          if (id.includes('vite/preload-helper')) {
            return 'preload';
          }
          if (id.includes('node_modules/buffer/') || id.includes('node_modules/base64-js/') || id.includes('node_modules/ieee754/')) {
            return 'buffer-polyfill';
          }
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query-vendor';
          }
          if (id.includes('node_modules/@walletconnect/') || id.includes('node_modules/@web3modal/')) {
            return 'walletconnect-vendor';
          }
          if (id.includes('node_modules/viem/') || id.includes('node_modules/wagmi/')) {
            return 'web3-vendor';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase-vendor';
          }
          if (id.includes('node_modules/@circle-fin/adapter-solana')) {
            return 'solana-vendor';
          }
          if (id.includes('node_modules/@circle-fin/bridge-kit') || id.includes('node_modules/@circle-fin/provider-cctp-v2') || id.includes('node_modules/@circle-fin/adapter-viem-v2')) {
            return 'circle-bridge-vendor';
          }
          if (id.includes('node_modules/@circle-fin/')) {
            return 'circle-vendor';
          }
          if (id.includes('node_modules/@sentry/')) {
            return 'sentry-vendor';
          }
          if (id.includes('node_modules/date-fns/')) {
            return 'date-vendor';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons-vendor';
          }
          if (id.includes('node_modules/@radix-ui/')) {
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
