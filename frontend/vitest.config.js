// Test-only config. Named vitest.config.js (not vite.config.js) so the
// production `vite build` continues to use its existing default behavior.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{js,jsx}"],
  },
});
