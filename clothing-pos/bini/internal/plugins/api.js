import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import os from 'os'

const BINIJS_VERSION = "9.1.5";

const rateLimit = new Map();
const handlerCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60000;
  const requests = (rateLimit.get(ip) || []).filter(time => time > windowStart);
  
  if (requests.length >= 100) {
    return false;
  }
  
  requests.push(now);
  rateLimit.set(ip, requests);
  return true;
}

async function loadApiHandler(routePath, viteServer) {
  const now = Date.now();
  const cacheKey = `${routePath}-${viteServer ? 'vite' : 'node'}`;
  
  // Shorter cache TTL in development for hot reload
  const devCacheTtl = viteServer ? 1000 : CACHE_TTL;
  
  const cached = handlerCache.get(cacheKey);
  
  if (cached && now - cached.timestamp < devCacheTtl && !viteServer) {
    return cached.handler;
  }

  try {
    const apiDir = path.join(process.cwd(), 'src/app/api');
    const extensions = ['.js', '.ts', '.mjs', '.cjs'];
    let handlerPath = null;
    
    // Find the handler file
    for (const ext of extensions) {
      const testPath = path.join(apiDir, routePath + ext);
      if (fs.existsSync(testPath)) {
        handlerPath = testPath;
        break;
      }
    }
    
    if (!handlerPath) {
      return null;
    }

    let handlerModule;
    
    if (viteServer && handlerPath.endsWith('.ts')) {
      // Use Vite's transform to handle TypeScript files in development
      try {
        // Transform TypeScript to JavaScript using Vite - no console output
        const transformed = await viteServer.transformRequest(handlerPath);
        
        if (!transformed || !transformed.code) {
          throw new Error('Vite transformation returned empty result');
        }
        
        // Create a temporary module from the transformed code
        const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(transformed.code)}`;
        handlerModule = await import(moduleUrl);
        
      } catch (transformError) {
        // Fallback: try direct import with query parameter - no console output
        try {
          const handlerUrl = pathToFileURL(handlerPath).href + '?t=' + Date.now();
          handlerModule = await import(handlerUrl);
        } catch (directImportError) {
          throw new Error(`Cannot load API route ${routePath}: ${directImportError.message}`);
        }
      }
    } else if (handlerPath.endsWith('.ts') && !viteServer) {
      // In production/preview mode, handle TypeScript
      try {
        // Try to use dynamic import with TypeScript support
        const handlerUrl = pathToFileURL(handlerPath).href + '?t=' + Date.now();
        handlerModule = await import(handlerUrl);
      } catch (tsError) {
        // Fallback: Try to compile TypeScript manually
        try {
          const ts = await import('typescript');
          const fileContent = fs.readFileSync(handlerPath, 'utf8');
          
          // Simple TypeScript transpilation
          const result = ts.transpileModule(fileContent, {
            compilerOptions: {
              target: ts.ScriptTarget.ES2020,
              module: ts.ModuleKind.ESNext,
              jsx: ts.JsxEmit.React,
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
            }
          });
          
          const compiledCode = result.outputText;
          const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(compiledCode)}`;
          handlerModule = await import(moduleUrl);
        } catch (compileError) {
          throw new Error(
            `TypeScript API routes require tsx or ts-node in production. ` +
            `Install with: npm install -D tsx\n` +
            `Or convert ${routePath} to JavaScript.`
          );
        }
      }
    } else {
      // Regular JavaScript file import - force fresh import in development
      const timestamp = viteServer ? Date.now() : 0;
      const handlerUrl = pathToFileURL(handlerPath).href + '?t=' + timestamp;
      handlerModule = await import(handlerUrl);
    }
    
    const handler = handlerModule.default;
    
    if (typeof handler !== 'function') {
      throw new Error('Invalid API handler - must export a default function');
    }
    
    // Only cache in production - skip caching in development for hot reload
    if (!viteServer) {
      handlerCache.set(cacheKey, { handler, timestamp: now });
    }
    
    return handler;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Enhanced file watcher for hot reload - silent version
function setupFileWatcher(viteServer) {
  const apiDir = path.join(process.cwd(), 'src/app/api');
  if (viteServer && fs.existsSync(apiDir)) {
    viteServer.watcher.add(apiDir);
    
    const handleApiFileChange = (file) => {
      if (file.includes('src/app/api') && /\.(js|ts)$/.test(file)) {
        const routePath = path.relative(apiDir, file).replace(/\.(js|ts)$/, '');
        
        // Clear all related cache entries silently
        const cacheKeys = Array.from(handlerCache.keys());
        cacheKeys.forEach(key => {
          if (key.includes(routePath) || key.includes('vite')) {
            handlerCache.delete(key);
          }
        });
        
        // Send silent HMR event (no console output)
        viteServer.ws.send({
          type: 'custom',
          event: 'api-update',
          data: { 
            route: routePath,
            file: path.basename(file),
            timestamp: Date.now()
          }
        });
      }
    };

    // Watch for all file operations silently
    viteServer.watcher.on('change', (file) => handleApiFileChange(file));
    viteServer.watcher.on('add', (file) => handleApiFileChange(file));
    viteServer.watcher.on('unlink', (file) => handleApiFileChange(file));
    viteServer.watcher.on('addDir', (dir) => {
      if (dir.includes('src/app/api') && !dir.includes('node_modules')) {
        // Clear cache silently for directory changes
        const cacheKeys = Array.from(handlerCache.keys());
        cacheKeys.forEach(key => handlerCache.delete(key));
      }
    });
    viteServer.watcher.on('unlinkDir', (dir) => {
      if (dir.includes('src/app/api') && !dir.includes('node_modules')) {
        // Clear cache silently for directory changes
        const cacheKeys = Array.from(handlerCache.keys());
        cacheKeys.forEach(key => handlerCache.delete(key));
      }
    });
  }
}

async function handleApiRequest(req, res, viteServer = null) {
  const clientIp = req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + 60);
    res.end(JSON.stringify({ error: 'Too many requests' }));
    return;
  }

  const now = Date.now();
  const windowStart = now - 60000;
  const requests = (rateLimit.get(clientIp) || []).filter(time => time > windowStart);
  const remaining = Math.max(0, 100 - requests.length);
  
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.floor(now / 1000) + 60);
  
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let routePath = url.pathname.replace('/api/', '') || 'index';
    
    if (routePath.endsWith('/')) {
      routePath = routePath.slice(0, -1);
    }
    
    const handler = await loadApiHandler(routePath, viteServer);
    
    if (!handler) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'API route not found',
        path: routePath,
        availableExtensions: ['.js', '.ts', '.mjs', '.cjs']
      }));
      return;
    }
    
    let body = {};
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.headers['content-type'] === 'application/json') {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        if (raw) {
          body = JSON.parse(raw);
        }
      } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
    }
    
    const request = {
      method: req.method,
      headers: req.headers,
      body,
      query: Object.fromEntries(url.searchParams),
      params: {},
      ip: clientIp,
      url: req.url
    };
    
    const response = {
      status: (code) => {
        res.statusCode = code;
        return response;
      },
      setHeader: (name, value) => {
        res.setHeader(name, value);
        return response;
      },
      json: (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data, null, 2));
      },
      send: (data) => {
        if (typeof data === 'string') {
          res.setHeader('Content-Type', 'text/plain');
          res.end(data);
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        }
      },
      end: (data) => {
        res.end(data);
      }
    };
    
    // Add timeout for handler execution
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Handler timeout')), 30000)
    );
    
    const handlerPromise = Promise.resolve().then(() => handler(request, response));
    const result = await Promise.race([handlerPromise, timeoutPromise]);
    
    if (result && !res.writableEnded) {
      response.json(result);
    }
    
  } catch (error) {
    if (!res.writableEnded) {
      res.statusCode = error.message === 'Handler timeout' ? 504 : 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: error.message === 'Handler timeout' ? 'Request timeout' : 'Internal Server Error',
        message: error.message,
        ...(viteServer && { stack: error.stack })
      }));
    }
  }
}

export function biniAPIPlugin(options = {}) {
  const { isPreview = false } = options;
  let viteServer = null;
  
  return {
    name: 'bini-api-plugin',
    
    configureServer(server) {
      viteServer = server;
      setupFileWatcher(viteServer);
      
      server.middlewares.use('/api', async (req, res) => {
        await handleApiRequest(req, res, viteServer);
      });

      // Silent development middleware
      server.middlewares.use('/api/_dev', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          message: 'Bini.js Development API',
          hotReload: true,
          cacheSize: handlerCache.size,
          timestamp: Date.now()
        }));
      });
    },
    
    configurePreviewServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        await handleApiRequest(req, res, null);
      });
    },
    
    buildStart() {
      const apiDir = path.join(process.cwd(), 'src/app/api');
      if (fs.existsSync(apiDir)) {
        // Silent build logging
        try {
          const files = fs.readdirSync(apiDir, { recursive: true });
          const apiRoutes = files.filter(file => 
            /\.(js|ts)$/.test(file) && !file.includes('node_modules')
          );
          // No console output during build
        } catch (error) {
          // Silent error handling
        }
      }
    },
    
    // Silent HMR for API routes
    handleHotUpdate({ file, server, modules }) {
      if (file.includes('src/app/api') && /\.(js|ts)$/.test(file)) {
        const apiDir = path.join(process.cwd(), 'src/app/api');
        const routePath = path.relative(apiDir, file).replace(/\.(js|ts)$/, '');
        
        // Clear all cache entries silently
        const cacheKeys = Array.from(handlerCache.keys());
        cacheKeys.forEach(key => {
          if (key.includes(routePath) || key.includes('vite')) {
            handlerCache.delete(key);
          }
        });
        
        // Send silent HMR event
        server.ws.send({
          type: 'custom',
          event: 'api-update',
          data: { 
            route: routePath,
            file: path.basename(file),
            action: 'reload',
            timestamp: Date.now()
          }
        });

        // Silent full-reload fallback
        setTimeout(() => {
          server.ws.send({
            type: 'full-reload',
            path: '*'
          });
        }, 100);
      }
      
      return modules;
    },

    // Transform index.html to add silent API HMR client
    transformIndexHtml(html) {
      if (process.env.NODE_ENV !== 'production') {
        const hmrScript = `
          <script type="module">
            // Silent API Hot Reload Client
            if (import.meta.hot) {
              import.meta.hot.on('api-update', (data) => {
                // Completely silent - no console logs or notifications
              });
            }
          </script>
        `;
        return html.replace('</body>', hmrScript + '</body>');
      }
      return html;
    }
  }
}