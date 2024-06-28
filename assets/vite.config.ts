import { UserConfig, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command }) => {
  const isDev = command !== "build";
  if (isDev) {
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
      sourcemap: false,
      manifest: true,
      minify: true,
      outDir: path.resolve(__dirname, "../priv/static"),
      target: "esnext",
      rollupOptions: {
        input: {
          main: "./src/main.tsx",
        },
        output: {
          manualChunks: (id: string) => {
            if (id.includes("i18n")) {
              return "i18n";
            }

            if (id.includes("framer-motion")) {
              return "framer-motion";
            }

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
