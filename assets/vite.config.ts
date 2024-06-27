import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command }) => {
  const isDev = command !== "build";
  if (isDev) {
    // Terminate the watcher when Phoenix quits
    process.stdin.on("close", () => {
      process.exit(0);
    });

    process.stdin.resume();
  }

  /** @type {import('vite').UserConfig} */
  const config = {
    server: {
      proxy: {
        "/socket": {
          target: "http://localhost:4000",
          ws: true,
        },
      },
    },
    publicDir: "static",
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      emptyOutDir: true,
      sourcemap: true,
      manifest: true,
      minify: true,
      outDir: "../priv/static",
      target: "esnext", // build for recent browsers
      rollupOptions: {
        input: {
          main: "./src/main.tsx",
        },
        output: {
          manualChunks: (id: string) => {
            if (id.includes("redux")) {
              return "redux";
            }

            if (id.includes("react") || id.includes("scheduler.production")) {
              return "react";
            }
          },
        },
      },
    },
  };

  return config;
});
