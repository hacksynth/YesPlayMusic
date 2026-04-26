import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron/simple';
import { VitePWA } from 'vite-plugin-pwa';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolve = dir => path.resolve(__dirname, dir);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isElectron = process.env.IS_ELECTRON === 'true';

  const defineEnv = {
    'process.env.IS_ELECTRON': JSON.stringify(isElectron),
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env.BASE_URL': JSON.stringify('/'),
    'process.platform': JSON.stringify(process.platform),
    'process.env.VUE_APP_NETEASE_API_URL': JSON.stringify(
      env.VUE_APP_NETEASE_API_URL || '/api'
    ),
    'process.env.VUE_APP_ELECTRON_API_URL': JSON.stringify(
      env.VUE_APP_ELECTRON_API_URL || '/api'
    ),
    'process.env.VUE_APP_ELECTRON_API_URL_DEV': JSON.stringify(
      env.VUE_APP_ELECTRON_API_URL_DEV || 'http://127.0.0.1:10754'
    ),
    'process.env.VUE_APP_LASTFM_API_KEY': JSON.stringify(
      env.VUE_APP_LASTFM_API_KEY || ''
    ),
    'process.env.VUE_APP_REAL_IP': JSON.stringify(env.VUE_APP_REAL_IP || ''),
    'process.env.VUE_APP_TOUBIEC_API_URL': JSON.stringify(
      env.VUE_APP_TOUBIEC_API_URL || '/toubiec-wyapi'
    ),
  };

  return {
    resolve: {
      alias: {
        '@': resolve('src'),
        vue: '@vue/compat',
        vuex: resolve('src/store/piniaVuexCompat.js'),
      },
    },
    define: defineEnv,
    server: {
      host: '0.0.0.0',
      port: Number(env.DEV_SERVER_PORT) || 8080,
      proxy: {
        '/api': {
          target:
            env.VUE_APP_NETEASE_API_PROXY_TARGET ||
            (isElectron ? 'http://127.0.0.1:10754' : 'http://localhost:3000'),
          changeOrigin: true,
          rewrite: url => url.replace(/^\/api/, ''),
        },
      },
    },
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
      createSvgIconsPlugin({
        iconDirs: [resolve('src/assets/icons')],
        symbolId: 'icon-[name]',
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'img/icons/favicon-32x32.png'],
        manifest: {
          name: 'YesPlayMusic',
          short_name: 'YesPlayMusic',
          theme_color: '#ffffff00',
          background_color: '#335eea',
          icons: [
            {
              src: '/img/icons/android-chrome-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/img/icons/android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
      isElectron &&
        electron({
          main: {
            entry: 'src/background.js',
            vite: {
              resolve: {
                alias: {
                  '@': resolve('src'),
                },
              },
              define: defineEnv,
              build: {
                outDir: 'dist-electron',
                emptyOutDir: true,
                rollupOptions: {
                  output: {
                    entryFileNames: 'background.js',
                  },
                  external: ['electron', '@unblockneteasemusic/rust-napi'],
                },
              },
            },
          },
          renderer: {},
          preload: {
            input: 'src/preload.js',
            vite: {
              build: {
                outDir: 'dist-electron',
                emptyOutDir: false,
                rollupOptions: {
                  output: {
                    entryFileNames: 'preload.js',
                  },
                  external: ['electron'],
                },
              },
            },
          },
        }),
    ],
    build: {
      sourcemap: false,
    },
    optimizeDeps: {
      exclude: ['@unblockneteasemusic/rust-napi'],
    },
  };
});
