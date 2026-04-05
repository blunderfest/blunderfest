import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  const isDev = command !== 'build';
  if (isDev) {
    // Terminate the watcher when Phoenix quits
    process.stdin.on('close', () => {
      process.exit(0);
    });

    process.stdin.resume();
  }

  return {
    plugins: [react(), vanillaExtractPlugin()],
  };
});
