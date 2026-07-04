import { useMemo, useState } from "react";
import type { Project, ProjectFile } from "@/store/projects";
import { Loader2, RefreshCw } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findFile(files: ProjectFile[], name: string): ProjectFile | undefined {
  return files.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

/**
 * Resolve a src/href attribute to a ProjectFile.
 * Handles: "./foo.css", "foo.css", "/src/foo.tsx", "src/foo.tsx"
 */
function resolveRef(ref: string, files: ProjectFile[]): ProjectFile | undefined {
  const clean = ref.replace(/^\.\//, "").replace(/^\//, "");
  return files.find(
    (f) =>
      f.name.toLowerCase() === clean.toLowerCase() ||
      f.path.toLowerCase() === clean.toLowerCase() ||
      f.path.toLowerCase().endsWith("/" + clean.toLowerCase()),
  );
}

/**
 * Inline all external <link rel="stylesheet"> and <script src="..."> tags.
 * Keeps type="module" scripts from Vite templates working by inlining them too.
 */
function inlineExternalRefs(html: string, files: ProjectFile[]): string {
  // <link rel="stylesheet" href="..."> or <link href="..." rel="stylesheet">
  html = html.replace(
    /<link\b([^>]*)\/?>/gi,
    (tag, attrs: string) => {
      const relMatch = attrs.match(/rel=["']stylesheet["']/i);
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
      if (!relMatch || !hrefMatch) return tag; // keep non-stylesheet links
      const f = resolveRef(hrefMatch[1], files);
      return f ? `<style>/* ${f.name} */\n${f.content}\n</style>` : "";
    },
  );

  // <script src="..." [type="module"]></script>
  html = html.replace(
    /<script\b([^>]*)><\/script>/gi,
    (tag, attrs: string) => {
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      if (!srcMatch) return tag; // inline script — keep as-is
      const src = srcMatch[1];
      // Keep CDN/external URLs
      if (/^https?:\/\/|^\/\//.test(src)) return tag;
      const f = resolveRef(src, files);
      // Strip type="module" — we inline the content as plain script
      return f ? `<script>/* ${f.name} */\n${f.content}\n</script>` : "";
    },
  );

  return html;
}

// ---------------------------------------------------------------------------
// Detect project "mode": react | html
// ---------------------------------------------------------------------------
type PreviewMode = "react" | "html" | "none";

function detectMode(project: Project): PreviewMode {
  const hasJsx = project.files.some((f) => /\.(jsx|tsx)$/i.test(f.name));
  const hasHtml = project.files.some((f) => f.name.toLowerCase() === "index.html");

  // Explicit type always wins
  if (project.type === "react") return "react";
  if (project.type === "html") return hasHtml ? "html" : "none";

  // Vite-like project: index.html + JSX → use React renderer (HTML is just scaffold)
  if (hasJsx) return "react";
  if (hasHtml) return "html";
  return "none";
}

// ---------------------------------------------------------------------------
// Build srcDoc for HTML projects
// ---------------------------------------------------------------------------
function buildHtmlSrcDoc(project: Project): string {
  const html = findFile(project.files, "index.html");
  if (!html) return noPreviewDoc("Pas de fichier index.html dans ce projet.");

  let content = inlineExternalRefs(html.content, project.files);

  // Ensure viewport meta (mobile)
  if (!content.includes("viewport")) {
    content = content.replace(/<head\b[^>]*>/i, (m) => `${m}<meta name="viewport" content="width=device-width,initial-scale=1"/>`);
  }

  // Inject any CSS not already inlined (safety net for missed links)
  const inlinedCss = project.files
    .filter((f) => f.name.toLowerCase().endsWith(".css") && content.includes(f.content.slice(0, 30)))
    .map((f) => f.name);

  const extraCss = project.files
    .filter((f) => f.name.toLowerCase().endsWith(".css") && !inlinedCss.includes(f.name))
    .map((f) => f.content)
    .join("\n");

  if (extraCss) {
    if (content.includes("</head>")) {
      content = content.replace(/<\/head>/i, `<style>${extraCss}</style></head>`);
    } else {
      content = `<style>${extraCss}</style>\n` + content;
    }
  }

  return content;
}

// ---------------------------------------------------------------------------
// Build srcDoc for React/JSX projects (Babel standalone in-browser bundler)
// ---------------------------------------------------------------------------
function buildReactSrcDoc(project: Project): string {
  // Collect CSS
  const css = project.files
    .filter((f) => f.name.toLowerCase().endsWith(".css"))
    .map((f) => `/* ${f.name} */\n${f.content}`)
    .join("\n");

  // Collect all JS/JSX/TS/TSX sources
  const sourceFiles = project.files.filter((f) => /\.(m?jsx?|tsx?)$/i.test(f.name));

  // Build a file registry keyed by name AND path (no duplicates)
  const filesMap: Record<string, string> = {};
  for (const f of sourceFiles) {
    filesMap[f.name] = f.content;
    if (f.path && f.path !== f.name) {
      filesMap[f.path] = f.content;
    }
  }

  // Determine entry point name (for error messages)
  const entryName =
    sourceFiles.find((f) => /^(App|app)\.(jsx|tsx)$/i.test(f.name))?.name ??
    sourceFiles.find((f) => /^index\.(jsx|tsx)$/i.test(f.name))?.name ??
    sourceFiles[0]?.name ??
    "App.jsx";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>*{box-sizing:border-box}body{margin:0;padding:0}\n${css}</style>
</head>
<body>
<div id="root"></div>

<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

<script>
// ── File registry ──────────────────────────────────────────────────────────
var __files = ${JSON.stringify(filesMap)};
var __modules = {};   // compiled module cache
var __compiling = {}; // circular-guard set

// ── Resolver: map a require() string → registry key ───────────────────────
function __resolve(mod) {
  if (__files[mod]) return mod;
  var bare = mod.replace(/^[.]{1,2}\\//, '').replace(/^[.]{1,2}\\\\/, '');
  var exts = ['', '.jsx', '.tsx', '.js', '.ts'];
  for (var i = 0; i < exts.length; i++) {
    var candidate = bare + exts[i];
    var found = Object.keys(__files).find(function(k) {
      return k.toLowerCase() === candidate.toLowerCase() ||
             k.toLowerCase().endsWith('/' + candidate.toLowerCase());
    });
    if (found) return found;
  }
  // index file inside directory
  for (var j = 0; j < exts.length; j++) {
    var idx = bare + '/index' + exts[j];
    var fi = Object.keys(__files).find(function(k) {
      return k.toLowerCase() === idx.toLowerCase() ||
             k.toLowerCase().endsWith('/' + idx.toLowerCase());
    });
    if (fi) return fi;
  }
  return null;
}

// ── require() shim ────────────────────────────────────────────────────────
function __require(mod) {
  // Built-in shims
  if (mod === 'react' || mod === 'React') return React;
  if (mod === 'react-dom' || mod === 'react-dom/client') return {
    createRoot: function(el) { return ReactDOM.createRoot(el); },
    render: function(el, container) { ReactDOM.createRoot(container).render(el); }
  };

  var key = __resolve(mod);
  if (!key) { console.warn('[Preview] Module not found:', mod); return {}; }
  if (__modules[key]) return __modules[key].exports;

  // Circular guard: return partial exports (allows the module that IS compiling
  // to at least get an empty object — avoids infinite recursion)
  if (__compiling[key]) return __modules[key] ? __modules[key].exports : {};

  __compiling[key] = true;
  var module = { exports: {} };
  __modules[key] = module;

  try {
    // Babel: react + env presets so that:
    //   - JSX → React.createElement()
    //   - ESM import/export → CommonJS require()/module.exports
    var compiled = Babel.transform(__files[key], {
      presets: [
        ['env', { modules: 'commonjs', targets: { esmodules: true } }],
        'react'
      ],
      filename: key
    }).code;

    /* jshint ignore:start */
    var fn = new Function('require', 'module', 'exports', 'React', compiled);
    fn(__require, module, module.exports, React);
    /* jshint ignore:end */
  } catch(e) {
    console.error('[Preview] Compile error in ' + key + ':', e.message);
    module.exports.__error = e.message;
  }

  delete __compiling[key];
  return module.exports;
}

// ── Boot ──────────────────────────────────────────────────────────────────
function __showError(msg) {
  document.getElementById('root').innerHTML =
    '<div style="color:#f87171;padding:20px;font-family:monospace;font-size:13px;white-space:pre-wrap;background:#1a0000;min-height:100vh">' +
    '<b>⚠ Erreur preview</b>\\n\\n' + String(msg).replace(/</g,'&lt;') + '</div>';
}

window.addEventListener('load', function() {
  // Check CDN scripts loaded
  if (typeof React === 'undefined' || typeof Babel === 'undefined') {
    __showError('Chargement React/Babel échoué.\\nVérifiez votre connexion internet puis rafraîchissez.');
    return;
  }

  try {
    // Compile all source files
    Object.keys(__files).forEach(function(k) { __require(k); });

    // Find the App component:
    // Priority: App.jsx > App.tsx > index.jsx > index.tsx > first default export
    var priority = ['App.jsx','App.tsx','app.jsx','app.tsx','index.jsx','index.tsx'];
    var AppComponent = null;

    for (var i = 0; i < priority.length; i++) {
      var m = __modules[priority[i]];
      if (m && m.exports) {
        var exp = m.exports.default || m.exports.App || m.exports;
        if (typeof exp === 'function') { AppComponent = exp; break; }
      }
    }

    // Fallback: first module with a function default export
    if (!AppComponent) {
      var keys = Object.keys(__modules);
      for (var j = 0; j < keys.length; j++) {
        var mod = __modules[keys[j]];
        if (mod && mod.exports) {
          var df = mod.exports.default || mod.exports;
          if (typeof df === 'function') { AppComponent = df; break; }
        }
      }
    }

    if (!AppComponent) throw new Error('Aucun composant React trouvé.\\nAssurez-vous que App.jsx exporte un composant par défaut.');

    var root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AppComponent));
  } catch(e) {
    __showError(e.message || String(e));
  }
});
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Fallback: no preview possible
// ---------------------------------------------------------------------------
function noPreviewDoc(reason: string): string {
  return `<!doctype html><html><body style="background:#0b1220;color:#64748b;font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><p>${reason}</p></body></html>`;
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------
function buildSrcDoc(project: Project): string {
  const mode = detectMode(project);
  if (mode === "react") return buildReactSrcDoc(project);
  if (mode === "html") return buildHtmlSrcDoc(project);
  return noPreviewDoc("Aucun fichier prévisualisable.<br>Ajoutez un index.html ou un composant App.jsx.");
}

// ---------------------------------------------------------------------------
// Preview component
// ---------------------------------------------------------------------------
export function Preview({ project }: { project: Project }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const srcDoc = useMemo(() => {
    setLoading(true);
    return buildSrcDoc(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, refreshKey]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-xs font-semibold tracking-[0.25em] text-muted-foreground">PREVIEW</span>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Rafraîchir"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Iframe */}
      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <iframe
          key={refreshKey}
          title="Preview"
          srcDoc={srcDoc}
          // allow-same-origin: required for scripts to execute in Android WebView
          // (without it, null-origin sandboxing blocks JS execution entirely)
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          className="h-full w-full border-0"
          style={{ background: "#0b1220" }}
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
