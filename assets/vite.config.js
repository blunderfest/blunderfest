import react from "@vitejs/plugin-react";
import million from "million/compiler";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

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
      tsconfigPaths(),
    ],
    build: {
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      emptyOutDir: true,
      sourcemap: false,
      manifest: true,
      minify: true,
      outDir: "../priv/static",
      rollupOptions: {
        input: {
          main: "./src/main.jsx",
        },
        output: {
          manualChunks: {
            react: ["react", "react-dom", "million"],
            redux: ["@reduxjs/toolkit", "react-redux"],
            dnd: ["@dnd-kit/core"],
            tailwind: ["tailwind-variants", "@headlessui/tailwindcss", "@headlessui/react"],
            i18n: ["i18next", "i18next-browser-languagedetector"],
          },
        },
      },
    },
  };
});
