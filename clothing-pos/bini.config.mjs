export default {
  outDir: '.bini',
  port: 3000,
  host: 'localhost',
  api: {
    dir: 'src/app/api', // UPDATED: API inside app folder
    bodySizeLimit: '1mb',
    extensions: ['.js', '.ts', '.mjs'] // UPDATED: Support TypeScript
  },
  static: {
    dir: 'public',
    maxAge: 3600
  },
  build: {
    minify: true,
    sourcemap: true
  }
}