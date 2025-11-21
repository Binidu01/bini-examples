import { defineConfig } from 'vite';
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

const isPreview = process.env.npm_lifecycle_event === 'preview';
const isBuild = process.env.NODE_ENV === 'production';

// Detect Codespaces environment
const inCodespaces = Boolean(process.env.CODESPACE_NAME);
const port = biniConfig.port || 3000;

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    biniRouterPlugin(),
    biniSSRPlugin(),
    biniBadgePlugin(),
    biniAPIPlugin({ isPreview }),
    biniPreviewPlugin(),

    // HTML Minification
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

  // 🔥 DEV SERVER (FIXED for Codespaces, Local, Sandbox)
  server: {
    port,
    cors: true,
    open: false,

    // REQUIRED: expose dev server to Codespaces
    host: inCodespaces ? '0.0.0.0' : (biniConfig.host || 'localhost'),

    // FIX: HMR over Codespaces domain
    hmr: inCodespaces
      ? {
          protocol: 'wss',
          host: `${process.env.CODESPACE_NAME}-${port}.app.github.dev`,
          port: 443,
        }
      : {
          protocol: 'ws',
          host: 'localhost',
          port,
        },
  },

  // Public preview server
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
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',

        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info.pop();

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

    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
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

  ssr: {
    external: ['react', 'react-dom'],
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
}));
