import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "client/src/lib/**/*.test.ts"],
  },
  // Tests that render components need the automatic JSX runtime. The app build
  // gets this from @vitejs/plugin-react in vite.config.ts; this config has no
  // plugins, so esbuild would otherwise emit classic React.createElement calls
  // and fail with "React is not defined".
  esbuild: {
    jsx: "automatic",
  },
});
