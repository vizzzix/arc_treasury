import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Оптимизация для продакшена
    target: "esnext",
    minify: "esbuild", // Используем esbuild для более быстрой минификации
    // Удаляем console.log и debugger в продакшене через esbuild
    esbuild: {
      drop: mode === "production" ? ["console", "debugger"] : [],
    },
    rollupOptions: {
      output: {
        // Разделение чанков для лучшего кеширования
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes("node_modules")) {
            // React и связанные библиотеки
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
              return "vendor-react";
            }
            // Ethers.js
            if (id.includes("ethers")) {
              return "vendor-ethers";
            }
            // TanStack Query
            if (id.includes("@tanstack")) {
              return "vendor-query";
            }
            // Radix UI компоненты
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
            // Остальные vendor библиотеки
            return "vendor";
          }
        },
        // Оптимизация имен файлов
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
      },
    },
    // Увеличиваем лимит предупреждений для размера чанков
    chunkSizeWarningLimit: 1000,
    // Включаем source maps только в development
    sourcemap: mode === "development",
  },
}));
