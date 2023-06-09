import { ConfigEnv, defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import react from "@vitejs/plugin-react";

export default defineConfig(({ command }: ConfigEnv) => {
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
        plugins: [react(), tsconfigPaths()],
        server: {
            proxy: {
                "/socket": {
                    target: "http://localhost:4000",
                    ws: true,
                },
            },
        },
        test: {
            globals: true,
            environment: "jsdom",
            setupFiles: "./src/__test__/setupTests.ts",
        },
        build: {
            target: "esnext", // build for recent browsers
            outDir: "../priv/static", // emit assets to priv/static
            emptyOutDir: true,
            sourcemap: isDev, // enable source map in dev build
            manifest: false, // do not generate manifest.json
            rollupOptions: {
                input: {
                    main: "./src/main.tsx",
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
