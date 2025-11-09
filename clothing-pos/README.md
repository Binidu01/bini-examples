# clothing-pos

⚡ Lightning-fast Bini.js app with Next.js-like file structure.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

**Auto-opens browser** at http://localhost:3000 with Bini.js development server.

## 📦 Production Build (WITH API SUPPORT)

```bash
npm run build
npm run start  # Production server with API routes + auto-opens browser
```

## 🔄 Development vs Production

| Command | Purpose | Browser | APIs |
|---------|---------|---------|------|
| `npm run dev` | Development | ✅ Auto-opens | ✅ Working |
| `npm run preview` | Preview build | ✅ Auto-opens | ✅ Working |
| `npm run start` | Production | ✅ Auto-opens | ✅ Working |

## 🎯 New Features

### ⚡ Fastify Production Server
- ✅ **2x faster** than Express.js
- ✅ Built-in security with Helmet
- ✅ Rate limiting protection
- ✅ Gzip compression
- ✅ Graceful shutdown
- ✅ Health checks & metrics
- ✅ **Environment file display** (.env, .env.local) like Next.js

### 🖼️ Automatic Favicon Generation
- ✅ SVG, PNG formats automatically generated
- ✅ Multiple sizes for different devices (16x16, 32x32, 64x64, 180x180, 512x512)
- ✅ Open Graph image (1200x630) for social media sharing
- ✅ Apple Touch Icon for iOS devices
- ✅ Web Manifest for PWA support

### 🔍 Enhanced SEO & Social Media
- ✅ Complete Open Graph tags
- ✅ Twitter Card support  
- ✅ Keyword meta tags
- ✅ Proper favicon declarations
- ✅ Canonical URLs and robots meta

## 🏗️ Project Structure

```
clothing-pos/
├── src/
│   ├── app/           # Next.js app directory
│   │   ├── api/       # API routes (supports .ts and .js)
│   │   │   └── hello.ts # Example API route
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Home page
│   │   └── globals.css      # Global styles
├── public/            # Static assets
├── bini/              # Framework internals and plugins
├── .bini/             # Build outputs (like Next.js .next)
├── api-server.js      # ⚡ Fastify production server with API support
├── bini.config.mjs    # Bini.js configuration (ES modules)
├── vite.config.mjs    # Vite configuration (ES modules)
├── eslint.config.mjs  # ESLint configuration (ES modules)
├── tsconfig.json     # TypeScript configuration
├── bini-env.d.ts      # TypeScript environment
├── tailwind.config.js # Tailwind configuration
├── postcss.config.mjs  # PostCSS configuration
└── package.json       # Dependencies (Fastify included)
```

## 🔌 API Routes - WORKING EVERYWHERE

API routes now live in `src/app/api` and support both TypeScript (.ts) and JavaScript (.js):

```typescript
// src/app/api/hello.ts
export default function handler(req, res) {
  return {
    message: 'Hello from Bini.js TypeScript API!',
    timestamp: new Date().toISOString(),
    method: req.method,
    working: true,
    typeScript: true
  };
}
```

Access at: `http://localhost:3000/api/hello`

## 📝 TypeScript Support

API routes fully support TypeScript with proper type checking and IntelliSense.

## 🎨 Styling: Tailwind

✅ Tailwind CSS configured with blue background (#ecf3ff) and responsive cards



## 📝 Language: TypeScript

✅ TypeScript configured
✅ All config files use MJS (ES modules)

---

**Built with Bini.js v9.1.5** • [Documentation](https://bini.js.org)
