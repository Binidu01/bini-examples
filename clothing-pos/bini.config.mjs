// Detect Codespaces
const inCodespaces = Boolean(process.env.CODESPACE_NAME);
const port = process.env.BINI_PORT || 3000;

export default {
  outDir: '.bini',

  // Dynamically switch host based on environment
  port,
  host: inCodespaces ? '0.0.0.0' : 'localhost',

  api: {
    dir: 'src/app/api',
    bodySizeLimit: '1mb',
    extensions: ['.js', '.ts', '.mjs']
  },

  static: {
    dir: 'public',
    maxAge: 3600
  },

  build: {
    minify: true,
    sourcemap: true
  },

  // Optional: Exposes the public HMR hostname for Codespaces
  hmr: inCodespaces
    ? {
        protocol: 'wss',
        host: `${process.env.CODESPACE_NAME}-${port}.app.github.dev`,
        port: 443
      }
    : {
        protocol: 'ws',
        host: 'localhost',
        port
      }
};
