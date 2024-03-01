/* eslint-disable no-undef */

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import jsconfigPaths from "vite-jsconfig-paths";
import styleX from "vite-plugin-stylex";

export default defineConfig(({ command }) => {
  const isDev = command !== "build";
  if (isDev) {
    // Terminate the watcher when Phoenix quits
    process.stdin.on("close", () => {
      process.exit(0);
    });

    process.stdin.resume();
  }

  return {
    publicDir: "static",
    plugins: [react(), styleX(), jsconfigPaths()],
    server: {
      proxy: {
        "/socket": {
          target: "http://localhost:4000",
          ws: true,
        },
      },
    },
    build: {
      target: "esnext", // build for recent browsers
      outDir: "../priv/static", // emit assets to priv/static
      emptyOutDir: true,
      sourcemap: true, // enable source map in dev build
      manifest: true, // do not generate manifest.json
      rollupOptions: {
        input: {
          main: "src/main.jsx",
        },
      },
    },
  };
});
