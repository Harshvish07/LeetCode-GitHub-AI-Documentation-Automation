// Bundles the extension's TypeScript entry points with esbuild and copies
// its static assets (manifest.json, popup.html, popup.css) into dist/.
// A plain esbuild script is used instead of Vite here because MV3 background
// service workers and popup scripts are simple, independent bundles with no
// need for Vite's dev-server/HMR machinery.
import { context } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const extensionDir = resolve(scriptsDir, '..');
const distDir = resolve(extensionDir, 'dist');
const watch = process.argv.includes('--watch');

function copyStaticAssets() {
  mkdirSync(resolve(distDir, 'popup'), { recursive: true });
  cpSync(resolve(extensionDir, 'manifest.json'), resolve(distDir, 'manifest.json'));
  cpSync(resolve(extensionDir, 'src/popup/popup.html'), resolve(distDir, 'popup/popup.html'));
  cpSync(resolve(extensionDir, 'src/popup/popup.css'), resolve(distDir, 'popup/popup.css'));
}

const buildOptions = {
  entryPoints: {
    background: resolve(extensionDir, 'src/background/service-worker.ts'),
    'popup/popup': resolve(extensionDir, 'src/popup/popup.ts'),
    'content/leetcode': resolve(extensionDir, 'src/content/leetcode/index.ts'),
  },
  outdir: distDir,
  bundle: true,
  format: 'esm',
  target: 'chrome110',
  sourcemap: true,
  logLevel: 'info',
};

copyStaticAssets();

const ctx = await context(buildOptions);

if (watch) {
  await ctx.watch();
  console.log('[extension] watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log(`[extension] build complete -> ${distDir}`);
}
