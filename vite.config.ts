import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Relative base so the build works on any GitHub Pages path (user.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [svelte()],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
