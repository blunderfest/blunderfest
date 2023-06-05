import solidPlugin from 'vite-plugin-solid';
// import devtools from 'solid-devtools/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from "vite";

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
    plugins: [solidPlugin(), vanillaExtractPlugin()],
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
      manifest: false, // do not generate manifest.json
      rollupOptions: {
        input: {
          main: "./src/index.jsx",
        },
        output: {
          entryFileNames: "assets/[name].js", // remove hash
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name][extname]",
        },
      },
    },
  };
});
