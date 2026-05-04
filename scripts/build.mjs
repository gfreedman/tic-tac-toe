#!/usr/bin/env node
/**
 * Production build script.
 *
 * - Bundles src/main.ts to _site/dist/ with a content hash in the filename
 *   so browser caches are automatically busted on every deploy.
 * - Rewrites index.html's script src to match the hashed filename.
 * - Copies style.css into _site/ for a clean, self-contained deploy artifact.
 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';

mkdirSync('_site/dist', { recursive: true });

const result = await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  outdir: '_site/dist',
  sourcemap: true,
  entryNames: '[name]-[hash]',
  metafile: true,
  minify: true,
});

const jsOutput = Object.keys(result.metafile.outputs)
  .find(f => f.endsWith('.js') && !f.endsWith('.map'));

if (!jsOutput) throw new Error('esbuild produced no JS output');

const scriptPath = jsOutput.replace('_site/', '');

let html = readFileSync('index.html', 'utf8');
html = html.replace(/dist\/script[^"']*\.js[^"']*/, scriptPath);
writeFileSync('_site/index.html', html);
copyFileSync('style.css', '_site/style.css');

console.log(`Built → ${scriptPath}`);
