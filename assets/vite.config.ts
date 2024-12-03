import { defineConfig, UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => {
  const isDev = command !== "build";
  if (isDev) {
    process.stdin.on("close", () => {
      process.exit(0);
    });

    process.stdin.resume();
  }

  const config: UserConfig = {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": "http://localhost:4000",
        "/socket": {
          target: "http://localhost:4000",
          ws: true,
        },
      },
    },
    build: {
      outDir: "../priv/static",
      emptyOutDir: true,
    },
  };
  return config;
});
