/* eslint-disable no-undef */
import react from "@vitejs/plugin-react";
import million from "million/compiler";
import { defineConfig, splitVendorChunkPlugin } from "vite";
import jsconfigPaths from "vite-jsconfig-paths";

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
    server: {
      proxy: {
        "/socket": {
          target: "http://localhost:4000",
          ws: true,
        },
      },
    },
    plugins: [
      million.vite({
        auto: {
          threshold: 0.05,
        },
      }),
      react(),
      jsconfigPaths(),
      splitVendorChunkPlugin(),
    ],
    build: {
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      emptyOutDir: true,
      sourcemap: isDev,
      manifest: true,
      outDir: "../../../priv/static",
      rollupOptions: {
        input: {
          main: "./src/main.jsx",
        },
        output: {
          manualChunks(id) {
            if (id.includes("react")) {
              return "react";
            }

            if (id.includes("rxjs")) {
              return "rxjs";
            }

            if (id.includes("i18next")) {
              return "i18next";
            }
          },
        },
      },
    },
  };
});
