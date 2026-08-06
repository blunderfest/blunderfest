// Copies the Stockfish 18 lite single-threaded engine into public/engine/ so
// it is served verbatim (stable, un-hashed names). The stockfish.js build
// locates its wasm next to the worker script by replacing `.js` with `.wasm`,
// so the two files must share a path stem — Vite's content-hashed asset URLs
// break that convention in production.
import { copyFileSync, mkdirSync } from 'node:fs';

const source = new URL('../node_modules/stockfish/bin/', import.meta.url);
const target = new URL('../public/engine/', import.meta.url);

mkdirSync(target, { recursive: true });

for (const ext of ['js', 'wasm']) {
  const name = `stockfish-18-lite-single.${ext}`;
  copyFileSync(new URL(name, source), new URL(name, target));
}

console.log('engine copied to public/engine/');
