import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'client', 'src'),
      '@shared': path.resolve(process.cwd(), 'shared'),
      '@assets': path.resolve(process.cwd(), 'attached_assets'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['client/src/**/*.{test,spec}.{ts,tsx}'],
  },
});
