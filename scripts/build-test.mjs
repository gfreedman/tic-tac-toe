#!/usr/bin/env node
/** Compiles src/test-exports.ts → dist/test-exports.js for the test suite. */

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/test-exports.ts'],
  bundle: true,
  format: 'cjs',
  outfile: 'dist/test-exports.js',
  sourcemap: true,
});

console.log('Built → dist/test-exports.js');
