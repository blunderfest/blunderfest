/* eslint-disable no-undef */
import react from "@vitejs/plugin-react";
import million from "million/compiler";
import { defineConfig } from "vite";
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
    ],
    build: {
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      emptyOutDir: true,
      sourcemap: true,
      manifest: true,
      minify: false,
      outDir: "../../../priv/static",
      rollupOptions: {
        input: {
          main: "./src/main.jsx",
        },
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            store: ["@blunderfest/store"],
            i18n: ["i18next", "i18next-browser-languagedetector", "i18next-http-backend"],
          },
        },
      },
    },
  };
});
