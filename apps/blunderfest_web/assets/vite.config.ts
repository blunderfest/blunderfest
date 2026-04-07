import react from "@vitejs/plugin-react";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
		plugins: [react()],
		resolve: {
			alias: {
				"~": resolve(__dirname, "./src"),
			},
		},
		build: {
			outDir: "../priv/static",
			sourcemap: true,
		},
		server: {
			proxy: {
				"/api": "http://localhost:8080",
			},
		},
	};
});
