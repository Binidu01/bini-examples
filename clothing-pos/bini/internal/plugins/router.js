import fs from 'fs';
import path from 'path';

let regenerationLock = null;
const regenerationQueue = [];

function scanRoutes(dir, baseRoute = '') {
  const routes = [];
  
  try {
    if (!fs.existsSync(dir)) {
      return routes;
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const pageFiles = ['page.tsx', 'page.jsx', 'page.ts', 'page.js'];
        const pageFile = pageFiles.find(f => fs.existsSync(path.join(fullPath, f)));
        
        const isDynamic = entry.name.startsWith('[') && entry.name.endsWith(']');
        
        let currentRoutePath;
        if (isDynamic) {
          const paramName = entry.name.slice(1, -1);
          currentRoutePath = baseRoute + '/:' + paramName;
        } else {
          currentRoutePath = baseRoute + '/' + entry.name;
        }
        
        if (pageFile) {
          routes.push({
            path: currentRoutePath,
            file: path.join(fullPath, pageFile),
            dynamic: isDynamic,
            params: isDynamic ? [entry.name.slice(1, -1)] : [],
            name: entry.name
          });
        }
        
        routes.push(...scanRoutes(fullPath, currentRoutePath));
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not scan routes in ${dir}:`, error.message);
    return routes;
  }
  
  return routes;
}

function generateRouterCode(appDir, isTypeScript) {
  const routes = scanRoutes(appDir);
  
  const rootPageFiles = ['page.tsx', 'page.jsx', 'page.ts', 'page.js'];
  const rootPage = rootPageFiles.find(f => fs.existsSync(path.join(appDir, f)));
  
  if (rootPage) {
    routes.unshift({
      path: '/',
      file: path.join(appDir, rootPage),
      dynamic: false,
      params: [],
      name: 'Home'
    });
  }
  
  routes.sort((a, b) => {
    if (a.dynamic && !b.dynamic) return 1;
    if (!a.dynamic && b.dynamic) return -1;
    return a.path.length - b.path.length;
  });
  
  let imports = `import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './app/globals.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Page Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2rem',
          background: '#f8f9fa'
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '1rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            maxWidth: '600px',
            textAlign: 'center'
          }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#e74c3c' }}>⚠️ Page Error</h1>
            <p style={{ fontSize: '1rem', color: '#666', marginBottom: '1rem' }}>
              This page has an error. Please check the component:
            </p>
            <pre style={{ 
              background: '#f8f9fa', 
              padding: '1rem', 
              borderRadius: '0.5rem',
              textAlign: 'left',
              overflow: 'auto',
              fontSize: '0.875rem',
              color: '#e74c3c'
            }}>
              {this.state.error?.toString()}
            </pre>
            <a href="/" style={{ 
              display: 'inline-block',
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: '#00CFFF',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '0.5rem',
              fontWeight: '600'
            }}>
              ← Go Home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function SafeRoute({ component: Component, ...rest }) {
  return (
    <ErrorBoundary>
      <Component {...rest} />
    </ErrorBoundary>
  );
}

function EmptyPage({ pagePath }) {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem',
      background: '#f8f9fa'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '1rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        maxWidth: '600px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#3498db' }}>📄 Empty Page</h1>
        <p style={{ fontSize: '1rem', color: '#666', marginBottom: '1rem' }}>
          This page exists but has no content yet.
        </p>
        <code style={{ 
          background: '#f8f9fa', 
          padding: '0.5rem 1rem', 
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          color: '#3498db',
          display: 'block',
          marginBottom: '1rem'
        }}>
          {pagePath}
        </code>
        <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1.5rem' }}>
          Add a default export to this file and it will hot reload automatically!
        </p>
        <a href="/" style={{ 
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          background: '#00CFFF',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '0.5rem',
          fontWeight: '600'
        }}>
          ← Go Home
        </a>
      </div>
    </div>
  );
}
`;
  
  const importMap = new Map();
  let componentIndex = 0;
  
  routes.forEach(route => {
    const componentName = 'Page' + componentIndex++;
    const relativePath = path.relative(path.join(process.cwd(), 'src'), route.file).replace(/\\/g, '/');
    
    let isEmpty = false;
    try {
      const fileContent = fs.readFileSync(route.file, 'utf8').trim();
      if (fileContent.length === 0 || !fileContent.includes('export default')) {
        isEmpty = true;
      }
    } catch (err) {
      isEmpty = true;
    }
    
    if (isEmpty) {
      importMap.set(route.file, { empty: true, path: relativePath });
    } else {
      imports += `import ${componentName} from './${relativePath.replace(/\.tsx?$/, '').replace(/\.jsx?$/, '')}';
`;
      importMap.set(route.file, { empty: false, component: componentName });
    }
  });
  
  let routesCode = `
export default function App() {
  return (
    <Router>
      <Routes>
`;
  
  routes.forEach(route => {
    const importInfo = importMap.get(route.file);
    if (!importInfo) return;
    
    const comment = route.dynamic ? ` {/* Dynamic: ${route.path} */}` : '';
    
    if (importInfo.empty) {
      routesCode += `        <Route path="${route.path}" element={<EmptyPage pagePath="${importInfo.path}" />} />${comment}
`;
    } else {
      routesCode += `        <Route path="${route.path}" element={<SafeRoute component={${importInfo.component}} />} />${comment}
`;
    }
  });
  
  routesCode += `        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

function NotFound() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #00CFFF 0%, #0077FF 100%)',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem', fontWeight: 'bold' }}>404</h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Page not found</p>
      <p style={{ fontSize: '1rem', opacity: 0.8, marginBottom: '2rem' }}>
        The page you're looking for doesn't exist
      </p>
      <a href="/" style={{ 
        padding: '1rem 2rem',
        background: 'white',
        color: '#00CFFF',
        textDecoration: 'none',
        borderRadius: '0.5rem',
        fontWeight: '600',
        fontSize: '1.1rem',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}
      onMouseOver={(e) => {
        e.target.style.transform = 'translateY(-2px)';
        e.target.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
      }}
      onMouseOut={(e) => {
        e.target.style.transform = 'translateY(0)';
        e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
      }}>
        ← Back to Home
      </a>
    </div>
  );
}`;
  
  return imports + routesCode;
}

let regenerateTimeout = null;
let lastRoutes = '';

async function regenerateRoutesWithLock(routerPlugin, changeType = 'update') {
  // If already regenerating, queue the request
  if (regenerationLock) {
    return new Promise((resolve) => {
      regenerationQueue.push(resolve);
    });
  }

  regenerationLock = true;
  
  try {
    clearTimeout(routerPlugin.regenerateTimeout);
    
    routerPlugin.regenerateTimeout = setTimeout(async () => {
      try {
        await routerPlugin.regenerateRoutes(changeType);
        
        // Process any queued regenerations
        while (regenerationQueue.length > 0) {
          const nextResolve = regenerationQueue.shift();
          await routerPlugin.regenerateRoutes('queued');
          nextResolve();
        }
      } catch (error) {
        console.error('❌ Route regeneration failed:', error);
        // Clear queue on error
        regenerationQueue.length = 0;
      } finally {
        regenerationLock = null;
      }
    }, 100);
  } catch (error) {
    regenerationLock = null;
    throw error;
  }
}

export function biniRouterPlugin() {
  return {
    name: 'bini-router-plugin',
    
    config() {
      const appDir = path.join(process.cwd(), 'src/app');
      
      // ADDED: Check if app directory exists
      if (!fs.existsSync(appDir)) {
        console.warn('⚠️  src/app directory not found - file-based routing disabled');
        return;
      }
      
      const appTsxPath = path.join(process.cwd(), 'src/App.tsx');
      const appJsxPath = path.join(process.cwd(), 'src/App.jsx');
      
      const isTypeScript = fs.existsSync(appTsxPath);
      const targetPath = isTypeScript ? appTsxPath : appJsxPath;
      
      if (fs.existsSync(appDir)) {
        const newCode = generateRouterCode(appDir, isTypeScript);
        fs.writeFileSync(targetPath, newCode, 'utf8');
        lastRoutes = newCode;
      }
    },
    
    configureServer(server) {
      const appDir = path.join(process.cwd(), 'src/app');
      
      if (!fs.existsSync(appDir)) {
        return;
      }
      
      server.watcher.add(appDir);
      
      const regenerateApp = async (reason = 'File changed') => {
        if (regenerateTimeout) {
          clearTimeout(regenerateTimeout);
        }
        
        regenerateTimeout = setTimeout(async () => {
          const appTsxPath = path.join(process.cwd(), 'src/App.tsx');
          const appJsxPath = path.join(process.cwd(), 'src/App.jsx');
          
          const isTypeScript = fs.existsSync(appTsxPath);
          const targetPath = isTypeScript ? appTsxPath : appJsxPath;
          
          const newCode = generateRouterCode(appDir, isTypeScript);
          
          if (newCode !== lastRoutes) {
            fs.writeFileSync(targetPath, newCode, 'utf8');
            lastRoutes = newCode;
            
            setTimeout(() => {
              server.ws.send({
                type: 'full-reload',
                path: '*'
              });
            }, 100);
          }
        }, 300);
      };
      
      server.watcher.on('add', (file) => {
        if (file.includes('src' + path.sep + 'app') && /page\.(tsx|jsx|ts|js)$/.test(file)) {
          const pageName = path.basename(path.dirname(file));
          regenerateApp(`New page: ${pageName}`);
        }
      });
      
      server.watcher.on('unlink', (file) => {
        if (file.includes('src' + path.sep + 'app') && /page\.(tsx|jsx|ts|js)$/.test(file)) {
          const pageName = path.basename(path.dirname(file));
          regenerateApp(`Deleted page: ${pageName}`);
        }
      });
      
      server.watcher.on('addDir', (dir) => {
        if (dir.includes('src' + path.sep + 'app') && !dir.includes('node_modules')) {
          const dirName = path.basename(dir);
          setTimeout(() => {
            const pageFiles = ['page.tsx', 'page.jsx', 'page.ts', 'page.js'];
            const hasPage = pageFiles.some(f => fs.existsSync(path.join(dir, f)));
            if (hasPage) {
              regenerateApp(`New directory: ${dirName}`);
            }
          }, 500);
        }
      });
      
      server.watcher.on('unlinkDir', (dir) => {
        if (dir.includes('src' + path.sep + 'app') && !dir.includes('node_modules')) {
          const dirName = path.basename(dir);
          regenerateApp(`Deleted directory: ${dirName}`);
        }
      });
      
      server.watcher.on('change', (file) => {
        if (file.includes('src' + path.sep + 'app') && /page\.(tsx|jsx|ts|js)$/.test(file)) {
          try {
            const fileContent = fs.readFileSync(file, 'utf8').trim();
            const hasExport = fileContent.length > 0 && fileContent.includes('export default');
            
            const pageName = path.basename(path.dirname(file));
            regenerateApp(`Content updated: ${pageName}`);
          } catch (err) {
          }
        }
      });
    },
    
    buildStart() {
      const appDir = path.join(process.cwd(), 'src/app');
      const appTsxPath = path.join(process.cwd(), 'src/App.tsx');
      const appJsxPath = path.join(process.cwd(), 'src/App.jsx');
      
      const isTypeScript = fs.existsSync(appTsxPath);
      const targetPath = isTypeScript ? appTsxPath : appJsxPath;
      
      if (fs.existsSync(appDir)) {
        const newCode = generateRouterCode(appDir, isTypeScript);
        fs.writeFileSync(targetPath, newCode, 'utf8');
      }
    }
  }
}