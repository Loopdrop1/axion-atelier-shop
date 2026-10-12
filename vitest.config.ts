import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Unit-Tests laufen immer ohne Backend (Beispielkatalog), auch wenn Lovable eine .env mit der
    // echten Cloud-Adresse anlegt. Sonst würden Tests die Produktionsdatenbank abfragen.
    env: {
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      VITE_SUPABASE_PROJECT_ID: "",
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
