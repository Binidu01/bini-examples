export default {
  // Where Bini will output compiled assets
  outDir: ".bini",

  // Dev server settings
  port: 3000,
  host: "0.0.0.0",  // REQUIRED for Codespaces, Docker, EC2, Vercel Dev, etc.

  // API Routes configuration
  api: {
    dir: "src/app/api",               // API lives inside app folder
    bodySizeLimit: "2mb",             // Increased for images + rich forms
    extensions: [".js", ".ts", ".mjs"] // Full support for TypeScript + ESM
  },

  // Static file handling
  static: {
    dir: "public",
    maxAge: 3600,                     // 1 hour cache
    dotfiles: "deny",                 // BLOCK .env, .git, etc.
    immutable: false
  },

  // Build settings
  build: {
    minify: true,
    sourcemap: true,                  // Keep true or Codespaces breaks debugging
    target: "esnext",                 // Modern output
    clean: true,                      // Always clean old builds
    cssCodeSplit: true                // Faster loads
  },

  // CORS (especially for Codespaces)
  cors: {
    origin: "*",                      // Codespaces forces dynamic hostnames
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  },

  // Security Layer (mirror of Next.js defaults)
  security: {
    csp: {
      enabled: false,                 // Enable only when deploying
    },
    hidePoweredBy: true,
    referrerPolicy: "no-referrer",
    xssFilter: true,
    frameguard: "deny"
  },

  // Logging (because Codespaces hides errors unless explicit)
  logging: {
    level: "info",
    color: true,
    timestamp: true
  }
};
