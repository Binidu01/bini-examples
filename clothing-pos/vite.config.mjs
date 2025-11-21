import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { minify } from 'html-minifier-terser';

import { biniRouterPlugin } from './bini/internal/plugins/router.js';
import { biniBadgePlugin } from './bini/internal/plugins/badge.js';
import { biniSSRPlugin } from './bini/internal/plugins/ssr.js';
import { biniAPIPlugin } from './bini/internal/plugins/api.js';
import { biniPreviewPlugin } from './bini/internal/plugins/preview.js';
import biniConfig from './bini.config.mjs';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isPreview = process.env.npm_lifecycle_event === 'preview';
  const isBuild = command === 'build';
  const port = biniConfig.port || 3000;

  // Enhanced HMR configuration
  const hmrConfig = env.CODESPACE_NAME ? {
    clientPort: 443
  } : {
    host: process.env.HMR_HOST || 'localhost',
    port: process.env.HMR_PORT || 3000,
  };

  return {
    plugins: [
      react(),
      biniRouterPlugin(),
      biniSSRPlugin(),
      biniBadgePlugin(),
      biniAPIPlugin({ isPreview }),
      biniPreviewPlugin(),

      // HTML Minifier
      {
        name: 'bini-html-minifier',
        apply: 'build',
        closeBundle: async () => {
          const distDir = path.resolve('.bini/dist');
          if (!fs.existsSync(distDir)) return;

          const processHTML = async (filePath) => {
            const html = await fs.promises.readFile(filePath, 'utf8');
            const minified = await minify(html, {
              collapseWhitespace: true,
              removeComments: true,
              removeRedundantAttributes: true,
              removeEmptyAttributes: true,
              removeScriptTypeAttributes: true,
              removeStyleLinkTypeAttributes: true,
              minifyCSS: true,
              minifyJS: true,
            });
            await fs.promises.writeFile(filePath, minified, 'utf8');
          };

          const walk = async (dir) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) await walk(fullPath);
              else if (entry.name.endsWith('.html')) await processHTML(fullPath);
            }
          };

          await walk(distDir);
        },
      },
    ],

    server: {
      port,
      host: env.CODESPACE_NAME ? '0.0.0.0' : (biniConfig.host || 'localhost'),
      open: !env.CODESPACE_NAME, // Only auto-open in local development
      cors: true,
      hmr: hmrConfig,
    },

    preview: {
      port,
      open: true,
      host: '0.0.0.0',
      cors: true,
    },

    build: {
      outDir: '.bini/dist',
      sourcemap: biniConfig.build?.sourcemap !== false && !isBuild,
      emptyOutDir: true,
      minify: 'terser',
      cssCodeSplit: true,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,

      rollupOptions: {
        output: {
          // 🎯 CHUNK NAMING - Better caching with content hash
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          
          // 📁 ASSET ORGANIZATION
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            
            if (/png|jpe?g|gif|svg|webp|avif/.test(ext)) {
              return 'assets/images/[name]-[hash][extname]';
            } else if (/woff|woff2|eot|ttf|otf|ttc/.test(ext)) {
              return 'assets/fonts/[name]-[hash][extname]';
            } else if (ext === 'css') {
              return 'css/[name]-[hash][extname]';
            } else if (ext === 'json') {
              return 'data/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },

      // 🔄 TERSER MINIFICATION OPTIONS
      terserOptions: {
        compress: {
          drop_console: isBuild,
          drop_debugger: isBuild,
          pure_funcs: ['console.log', 'console.info'],
          passes: 2,
        },
        format: {
          comments: false,
        },
        mangle: {
          toplevel: true,
        },
      },
    },

    resolve: {
      alias: { '@': '/src' },
    },

    css: {
      modules: { localsConvention: 'camelCase' },
      devSourcemap: true,
    },

    // 🔍 OPTIMIZATION HINTS
    ssr: {
      external: ['react', 'react-dom'],
    },

    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
  };
});
