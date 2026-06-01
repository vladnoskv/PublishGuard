import { defineConfig } from 'tsup';
import * as path from 'node:path';

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  external: ['vscode'],
  noExternal: ['@publishguard/core'],
  clean: true,
  outDir: 'dist',
  noSplitting: true,
  platform: 'node',
  target: 'node18',
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      '@publishguard/core': path.resolve(__dirname, '../core/src/index.ts'),
    };
  },
});
