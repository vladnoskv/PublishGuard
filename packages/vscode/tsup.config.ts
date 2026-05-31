import { defineConfig } from 'tsup';

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
});
