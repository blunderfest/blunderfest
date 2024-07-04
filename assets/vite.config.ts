import { UserConfig, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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

  const config: UserConfig = {
    server: {
      proxy: {
        "/socket": {
          target: "http://localhost:4000",
          ws: true,
        },
      },
    },
    publicDir: "static",
    plugins: [react(), tsconfigPaths()],
    build: {
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      emptyOutDir: true,
      sourcemap: true,
      manifest: true,
      minify: false,
      outDir: "../priv/static",
      target: "esnext", // build for recent browsers
      rollupOptions: {
        input: {
          main: "./src/main.tsx",
        },
        output: {
          manualChunks: (id) => {
            if (id.includes("dnd-kit")) {
              return "dnd-kit";
            }

            if (id.includes("redux")) {
              return "redux";
            }

            if (id.includes("i18n")) {
              return "i18n";
            }

            if (id.includes("node_modules")) {
              return "vendor";
            }
          },
        },
      },
    },
  };

  return config;
});
