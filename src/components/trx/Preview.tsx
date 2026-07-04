import { useMemo, useState, useRef } from "react";
import type { Project, ProjectFile } from "@/store/projects";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all CSS file contents from the project */
function allCss(files: ProjectFile[]): string {
  return files
    .filter((f) => f.name.toLowerCase().endsWith(".css"))
    .map((f) => f.content)
    .join("\n");
}

/** Find a file by name (case-insensitive) */
function findFile(files: ProjectFile[], name: string): ProjectFile | undefined {
  return files.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

/**
 * Replace <link rel="stylesheet" href="./foo.css"> with actual <style> content.
 * Replace <script src="./foo.js"> with actual <script> content.
 * This is critical for srcDoc: relative file paths cannot be resolved.
 */
function inlineExternalRefs(html: string, files: ProjectFile[]): string {
  // Replace <link rel="stylesheet" href="..."> with inline <style>
  html = html.replace(
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi,
    (_, href) => {
      const name = href.replace(/^\.\//, "");
      const f = files.find(
        (f) => f.name.toLowerCase() === name.toLowerCase() || f.path.toLowerCase() === name.toLowerCase(),
      );
      return f ? `<style>/* ${f.name} */\n${f.content}\n</style>` : "";
    },
  );

  // Also handle reversed attribute order: href before rel
  html = html.replace(
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi,
    (_, href) => {
      const name = href.replace(/^\.\//, "");
      const f = files.find(
        (f) => f.name.toLowerCase() === name.toLowerCase() || f.path.toLowerCase() === name.toLowerCase(),
      );
      return f ? `<style>/* ${f.name} */\n${f.content}\n</style>` : "";
    },
  );

  // Replace <script src="./foo.js"> with inline <script>
  html = html.replace(
    /<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi,
    (_, before, src, after) => {
      // Skip external URLs (http://, https://, //)
      if (/^https?:\/\/|^\/\//.test(src)) return `<script${before}src="${src}"${after}></script>`;
      const name = src.replace(/^\.\//, "");
      const f = files.find(
        (f) => f.name.toLowerCase() === name.toLowerCase() || f.path.toLowerCase() === name.toLowerCase(),
      );
      return f ? `<script>/* ${f.name} */\n${f.content}\n</script>` : "";
    },
  );

  return html;
}

// ---------------------------------------------------------------------------
// Build srcDoc for HTML projects
// ---------------------------------------------------------------------------
function buildHtmlSrcDoc(project: Project): string {
  const html = findFile(project.files, "index.html");
  if (!html) {
    return noPreviewDoc("Pas de fichier index.html dans ce projet.");
  }

  // Inline all external file references
  let content = inlineExternalRefs(html.content, project.files);

  // Inject any CSS files not already linked (safety net)
  const extraCss = project.files
    .filter((f) => f.name.toLowerCase().endsWith(".css"))
    .filter((f) => !content.includes(f.content.slice(0, 50))) // rough dedup
    .map((f) => f.content)
    .join("\n");

  if (extraCss) {
    content = content.replace(/<\/head>/i, `<style>${extraCss}</style></head>`);
  }

  // Inject any JS files not already inlined (safety net)
  const extraJs = project.files
    .filter((f) => /\.(m?js)$/i.test(f.name) && f.name.toLowerCase() !== "index.html")
    .filter((f) => !content.includes(f.content.slice(0, 50)))
    .map((f) => f.content)
    .join("\n");

  if (extraJs) {
    content = content.replace(/<\/body>/i, `<script>${extraJs}</script></body>`);
  }

  // Ensure viewport meta is present (mobile)
  if (!content.includes("viewport")) {
    content = content.replace(
      /<head>/i,
      `<head><meta name="viewport" content="width=device-width,initial-scale=1"/>`,
    );
  }

  return content;
}

// ---------------------------------------------------------------------------
// Build srcDoc for React projects (JSX/TSX via Babel standalone)
// ---------------------------------------------------------------------------
function buildReactSrcDoc(project: Project): string {
  const css = allCss(project.files);

  // Collect all JS/JSX/TSX source files
  const sourceFiles = project.files.filter((f) => /\.(jsx?|tsx?)$/i.test(f.name));

  // Serialize files as JSON for the inline bundler
  const filesMap: Record<string, string> = {};
  for (const f of sourceFiles) {
    filesMap[f.name] = f.content;
    if (f.path && f.path !== f.name) filesMap[f.path] = f.content;
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box}
body{margin:0;padding:0}
${css}
</style>
</head>
<body>
<div id="root"></div>

<!-- React + Babel from CDN -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

<script>
// ── Mini module bundler ────────────────────────────────────────────────────
var __files = ${JSON.stringify(filesMap)};
var __modules = {};
var __compiling = {};

function __require(mod) {
  // React / React-DOM built-ins
  if (mod === 'react' || mod === 'React') return React;
  if (mod === 'react-dom' || mod === 'react-dom/client') return ReactDOM;
  if (mod === 'react-dom/client') return ReactDOM;

  // Resolve relative require to a filename
  var key = mod;
  if (!__files[key]) {
    var bare = mod.replace(/^[./]+/, '');
    key = Object.keys(__files).find(function(k) {
      return k === bare || k === bare + '.jsx' || k === bare + '.tsx'
          || k === bare + '.js' || k === bare + '.ts'
          || k.toLowerCase() === bare.toLowerCase() + '.jsx'
          || k.toLowerCase() === bare.toLowerCase() + '.tsx';
    }) || key;
  }

  if (__modules[key]) return __modules[key].exports;
  if (__compiling[key]) return {}; // circular guard
  if (!__files[key]) { console.warn('Module not found:', mod); return {}; }

  __compiling[key] = true;
  var module = { exports: {} };
  __modules[key] = module;

  try {
    var src = __files[key];
    // Transpile JSX/TSX via Babel
    var compiled = Babel.transform(src, {
      presets: ['react'],
      filename: key,
      plugins: []
    }).code;

    // Wrap as CommonJS
    var fn = new Function('require', 'module', 'exports', 'React', compiled);
    fn(__require, module, module.exports, React);
  } catch(e) {
    console.error('[Preview] Error compiling ' + key + ':', e.message);
    module.exports.__error = e.message;
  }
  delete __compiling[key];
  return module.exports;
}

// ── Compile all files up front ─────────────────────────────────────────────
window.addEventListener('load', function() {
  try {
    // Compile everything
    Object.keys(__files).forEach(function(k) { __require(k); });

    // Find the App component: prefer App.jsx / App.tsx default export
    var AppComponent = null;
    var entryNames = ['App.jsx', 'App.tsx', 'app.jsx', 'app.tsx', 'index.jsx', 'index.tsx'];
    for (var i = 0; i < entryNames.length; i++) {
      var m = __modules[entryNames[i]];
      if (m && (m.exports.default || m.exports.App)) {
        AppComponent = m.exports.default || m.exports.App;
        break;
      }
    }

    // Fallback: first module with a default export
    if (!AppComponent) {
      Object.values(__modules).forEach(function(m) {
        if (!AppComponent && m && m.exports && m.exports.default) {
          AppComponent = m.exports.default;
        }
      });
    }

    if (!AppComponent) throw new Error('Aucun composant React exporté par défaut.');

    var root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AppComponent));
  } catch(e) {
    document.getElementById('root').innerHTML =
      '<div style="color:#f87171;padding:20px;font-family:monospace;font-size:13px;background:#1a0a0a;min-height:100vh">' +
      '<b>Erreur preview React</b><br><br>' + e.message.replace(/</g,'&lt;') + '</div>';
  }
});
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// No preview placeholder
// ---------------------------------------------------------------------------
function noPreviewDoc(reason: string): string {
  return `<!doctype html><html><body style="background:#0b1220;color:#64748b;font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><p style="font-size:14px">${reason}</p></div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Main entry: choose the right builder
// ---------------------------------------------------------------------------
function buildSrcDoc(project: Project): string {
  const hasJsx = project.files.some((f) => /\.(jsx|tsx)$/i.test(f.name));
  const hasHtml = project.files.some((f) => f.name.toLowerCase() === "index.html");

  // React project: has JSX/TSX files or explicitly typed "react"
  if (project.type === "react" || (hasJsx && !hasHtml)) {
    return buildReactSrcDoc(project);
  }

  // HTML project
  if (hasHtml) {
    return buildHtmlSrcDoc(project);
  }

  // React with index.html (Vite-like structure) — use React renderer, ignore the HTML scaffold
  if (hasJsx && hasHtml) {
    return buildReactSrcDoc(project);
  }

  return noPreviewDoc("Aucun fichier prévisualisable. Ajoutez un index.html ou un composant App.jsx.");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function Preview({ project }: { project: Project }) {
  const [key, setKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const srcDoc = useMemo(() => buildSrcDoc(project), [project, key]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-xs font-semibold tracking-[0.25em] text-muted-foreground">PREVIEW</span>
        <button
          onClick={() => { setLoading(true); setKey((k) => k + 1); }}
          className="flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Rafraîchir"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Loading overlay */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <iframe
          key={key}
          title="Preview"
          srcDoc={srcDoc}
          // allow-same-origin is required for scripts to run in Android WebView
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          className="h-full w-full border-0"
          style={{ background: "#0b1220" }}
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
