import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolve = dir => path.resolve(__dirname, dir);

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          compatConfig: {
            MODE: 2,
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve('src'),
      vue: '@vue/compat',
      vuex: resolve('src/store/piniaVuexCompat.js'),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
