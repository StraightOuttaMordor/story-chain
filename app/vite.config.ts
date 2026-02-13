import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ["buffer", "crypto", "stream", "util", "process"],
      globals: { Buffer: true, process: true },
    }),
  ],
  resolve: {
    alias: {
      crypto: "crypto-browserify",
    },
  },
  define: {
    "process.env": {},
  },
});
