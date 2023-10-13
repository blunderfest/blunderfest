/* eslint-disable no-undef */

import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, splitVendorChunkPlugin } from "vite";

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
    plugins: [
      react(),
      splitVendorChunkPlugin(),
      visualizer({
        open: true,
        gzipSize: true,
        filename: "chunks-report.html",
      }),
    ],
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
      sourcemap: isDev, // enable source map in dev build
      manifest: true, // do not generate manifest.json
      rollupOptions: {
        input: "./src/main.jsx",
        output: {
          entryFileNames: "assets/[name].js", // remove hash
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name][extname]",
        },
      },
    },
    resolve: {
      alias: {
        "styled-system": resolve(__dirname, "./styled-system"),
        "@": resolve(__dirname, "./src"),
      },
      extensions: [".mjs", ".js", ".jsx", ".json"],
    },
  };
});
