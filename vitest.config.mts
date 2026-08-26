import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Config oficial de Next 16 para Vitest, leida de
// node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md.
// tsconfigPaths() es obligatorio: sin el, "@/lib/menu" no resuelve aca
// aunque tsconfig.json ya tenga el alias.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // jsdom por defecto (D-17): esta fase no necesita DOM (los route
    // handlers usan Request/Response nativos de Node), pero deja la
    // config lista para tests de componentes sin rehacerla. Los tests
    // de route handlers fuerzan "node" por archivo con el docblock
    // "@vitest-environment node".
    environment: "jsdom",
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
  },
});
