import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
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
        root: __dirname,
        cacheDir: "../node_modules/.vite/blunderfest",

        server: {
            proxy: {
                "/socket": {
                    target: "http://localhost:4000",
                    ws: true,
                },
            },
        },

        preview: {
            port: 4300,
            host: "localhost",
        },

        plugins: [react(), nxViteTsPaths(), vanillaExtractPlugin()],

        // Uncomment this if you are using workers.
        // worker: {
        //  plugins: [ nxViteTsPaths() ],
        // },

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
                    main: "blunderfest/src/main.tsx",
                },
            },
        },
    };
});
