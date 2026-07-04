import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";

// Dedicated SPA build for the Capacitor / Android APK.
// Uses a clean entry point without TanStack Start SSR features,
// which would otherwise render nested <html>/<body> tags inside
// the React root div — breaking all event handlers in Capacitor WebView.
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes.mobile",
      generatedRouteTree: "./src/routeTree.mobile.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      // Use mobile-specific HTML entry (no TanStack Start shell component)
      input: path.resolve(__dirname, "index.mobile.html"),
    },
  },
  base: "./",
});
