import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
	const isDev = command !== "build";

	if (isDev) {
		process.stdin.on("close", () => {
			process.exit(0);
		});
		process.stdin.resume();
	}

	return {
		plugins: [react(), vanillaExtractPlugin()],
		resolve: {
			alias: {
				"~": path.resolve(__dirname, "./src"),
			},
		},
		build: {
			outDir: "../priv/static",
			sourcemap: true,
		},
		server: {
			port: 5173,
			proxy: {
				"/api": "http://localhost:8080",
			},
		},
	};
});
