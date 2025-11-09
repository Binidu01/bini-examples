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

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    biniRouterPlugin(),
    biniSSRPlugin(),
    biniBadgePlugin(),
    biniAPIPlugin({ isPreview }),
    biniPreviewPlugin(),

    // 💣 Post-build HTML one-liner
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
            preserveLineBreaks: false,
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
    port: biniConfig.port || 3000,
    open: true,
    host: biniConfig.host || 'localhost',
    cors: true,
    hmr: {
      host: process.env.HMR_HOST || 'localhost',
      port: process.env.HMR_PORT || 3000,
    },
  },

  preview: {
    port: biniConfig.port || 3000,
    open: true,
    host: '0.0.0.0',
    cors: true,
  },

  build: {
    outDir: '.bini/dist',
    sourcemap: biniConfig.build?.sourcemap !== false,
    emptyOutDir: true,
    minify: 'terser', // requires terser installed
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
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
}));