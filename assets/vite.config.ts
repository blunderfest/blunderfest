import react from "@vitejs/plugin-react";
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
        plugins: [react(), tsconfigPaths()],
        build: {
            reportCompressedSize: true,
            commonjsOptions: {
                transformMixedEsModules: true,
            },
            emptyOutDir: true,
            sourcemap: true,
            manifest: true,
            rollupOptions: {
                input: {
                    main: "./src/main.tsx",
                },
            },
        },
    };
});
