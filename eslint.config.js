import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Von Lovable erzeugte Dateien: werden bei jeder Cloud-Änderung überschrieben, deshalb nicht prüfen.
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      "src/integrations/supabase/auth-attacher.ts",
      "src/integrations/supabase/auth-middleware.ts",
      "src/integrations/supabase/client.server.ts",
      "src/integrations/supabase/client.ts",
      "src/integrations/supabase/cron-auth.ts",
      "src/integrations/supabase/previewAuthStorage.ts",
      "src/integrations/supabase/types.ts",
      "drizzle/schema.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // TanStack-Routen müssen `Route` exportieren; Fast Refresh ersetzt dort ohnehin die ganze Routenmodul-Kette.
    // shadcn-Bausteine (src/components/ui) exportieren Varianten und Hooks neben den Komponenten, wie vom Generator vorgesehen.
    files: ["src/routes/**/*.{ts,tsx}", "src/components/ui/**/*.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  eslintPluginPrettier,
);
