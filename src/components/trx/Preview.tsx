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
 * Resolve a src/href relative path to a ProjectFile.
 * Handles: "./foo.css", "foo.css", "/src/foo.tsx", "src/App.css"
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
 * Detect if index.html is a Vite-style scaffold (body = only <div id="root"> + scripts)
 * vs a real HTML page with actual content.
 *
 * Strategy: strip from the body anything a scaffold legitimately has
 * (scripts, noscript, comments, the root div, whitespace). If nothing
 * meaningful remains, it's a scaffold.
 */
function isViteScaffold(htmlContent: string): boolean {
  const bodyMatch = htmlContent.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return false;

  let inner = bodyMatch[1];

  // Remove HTML comments
  inner = inner.replace(/<!--[\s\S]*?-->/g, "");
  // Remove <script>...</script> blocks (open/close and self-closing)
  inner = inner.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  inner = inner.replace(/<script\b[^>]*\/>/gi, "");
  // Remove <noscript>...</noscript>
  inner = inner.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
  // Remove the root div (id="root" or id='root')
  inner = inner.replace(/<div\b[^>]*\bid=["']root["'][^>]*>\s*<\/div>/gi, "");
  inner = inner.replace(/<div\b[^>]*\bid=["']root["'][^>]*\/>/gi, "");
  // Collapse whitespace
  inner = inner.replace(/\s+/g, "").trim();

  // A scaffold has nothing left after stripping the above.
  // Real pages still have structural elements: <header>, <main>, <section>, <p>, etc.
  return inner.length === 0;
}

// ---------------------------------------------------------------------------
// Detect preview mode: react | html | none
// ---------------------------------------------------------------------------
type PreviewMode = "react" | "html" | "none";

function detectMode(project: Project): PreviewMode {
  const htmlFile = findFile(project.files, "index.html");
  const hasHtml = !!htmlFile;
  const hasJsx = project.files.some((f) => /\.(jsx|tsx)$/i.test(f.name));

  // Explicit project type from user
  if (project.type === "html") return hasHtml ? "html" : "none";

  // React project or auto-detect with JSX files present
  if (project.type === "react" || hasJsx) {
    if (hasHtml) {
      // If index.html has REAL content (not just a Vite scaffold), show the HTML
      if (!isViteScaffold(htmlFile!.content)) return "html";
    }
    // No HTML, or HTML is scaffold → React render
    return hasJsx ? "react" : "none";
  }

  if (hasHtml) return "html";
  return "none";
}

// ---------------------------------------------------------------------------
// Inline external file refs into HTML
// Returns { html, inlinedCssNames, inlinedJsNames } so the caller can
// deduplicate by file identity (not content-fragment heuristics).
// Keeps CDN / external URLs completely untouched.
// ---------------------------------------------------------------------------
function inlineExternalRefs(
  html: string,
  files: ProjectFile[],
): { html: string; inlinedCssNames: Set<string>; inlinedJsNames: Set<string> } {
  const inlinedCssNames = new Set<string>();
  const inlinedJsNames = new Set<string>();

  // ── <link> stylesheet tags ────────────────────────────────────────────────
  html = html.replace(/<link\b([^>]*)\/?>/gi, (tag, attrs: string) => {
    const relMatch = attrs.match(/rel=["']stylesheet["']/i);
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!relMatch || !hrefMatch) return tag; // keep preconnect, icon, etc.

    const href = hrefMatch[1];
    if (/^https?:\/\/|^\/\//.test(href)) return tag; // keep CDN links (Google Fonts…)

    const f = resolveRef(href, files);
    if (!f) return tag; // local file not found → keep original
    inlinedCssNames.add(f.name);
    return `<style>/* ${f.name} */\n${f.content}\n</style>`;
  });

  // ── <script src="..."></script> tags ─────────────────────────────────────
  html = html.replace(/<script\b([^>]*)><\/script>/gi, (tag, attrs: string) => {
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) return tag; // inline script — keep as-is

    const src = srcMatch[1];
    if (/^https?:\/\/|^\/\//.test(src)) return tag; // keep CDN scripts

    // JSX/TSX/TS require transpilation — cannot inline in HTML mode; drop silently
    if (/\.(jsx|tsx|ts)$/i.test(src)) return "";

    const f = resolveRef(src, files);
    if (!f) return tag;
    inlinedJsNames.add(f.name);
    return `<script>/* ${f.name} */\n${f.content}\n</script>`;
  });

  return { html, inlinedCssNames, inlinedJsNames };
}

// ---------------------------------------------------------------------------
// Build srcDoc — HTML mode
// ---------------------------------------------------------------------------
function buildHtmlSrcDoc(project: Project): string {
  const html = findFile(project.files, "index.html");
  if (!html) return noPreviewDoc("Pas de fichier index.html dans ce projet.");

  const { html: content0, inlinedCssNames, inlinedJsNames } = inlineExternalRefs(
    html.content,
    project.files,
  );
  let content = content0;

  // Safety net: inject CSS files NOT already inlined (tracked by file identity)
  const extraCss = project.files
    .filter((f) => f.name.toLowerCase().endsWith(".css") && !inlinedCssNames.has(f.name))
    .map((f) => `/* ${f.name} */\n${f.content}`)
    .join("\n");
  if (extraCss) {
    if (/<\/head>/i.test(content)) {
      content = content.replace(/<\/head>/i, `<style>${extraCss}</style></head>`);
    } else {
      content = `<style>${extraCss}</style>\n` + content;
    }
  }

  // Safety net: inject plain JS files NOT already inlined
  const extraJs = project.files
    .filter((f) => /\.m?js$/i.test(f.name) && !inlinedJsNames.has(f.name))
    .map((f) => `/* ${f.name} */\n${f.content}`)
    .join("\n");
  if (extraJs) {
    if (/<\/body>/i.test(content)) {
      content = content.replace(/<\/body>/i, `<script>${extraJs}</script></body>`);
    } else {
      content += `<script>${extraJs}</script>`;
    }
  }

  // Ensure viewport meta (important for mobile)
  if (!content.includes("viewport")) {
    content = content.replace(
      /<head\b[^>]*>/i,
      (m) => `${m}<meta name="viewport" content="width=device-width,initial-scale=1"/>`,
    );
  }

  return content;
}

// ---------------------------------------------------------------------------
// Build srcDoc — React/JSX mode (Babel standalone in-browser bundler)
// ---------------------------------------------------------------------------
function buildReactSrcDoc(project: Project): string {
  const css = project.files
    .filter((f) => f.name.toLowerCase().endsWith(".css"))
    .map((f) => `/* ${f.name} */\n${f.content}`)
    .join("\n");

  const sourceFiles = project.files.filter((f) => /\.(m?jsx?|tsx?)$/i.test(f.name));

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
<style>*{box-sizing:border-box}body{margin:0;padding:0}\n${css}</style>
</head>
<body>
<div id="root"></div>

<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

<script>
var __files = ${JSON.stringify(filesMap)};
var __modules = {};
var __compiling = {};

function __resolve(mod) {
  if (__files[mod]) return mod;
  var bare = mod.replace(/^[.]{1,2}[\\/]/, '');
  var exts = ['', '.jsx', '.tsx', '.js', '.ts'];
  for (var i = 0; i < exts.length; i++) {
    var c = bare + exts[i];
    var found = Object.keys(__files).find(function(k) {
      return k.toLowerCase() === c.toLowerCase() ||
             k.toLowerCase().endsWith('/' + c.toLowerCase());
    });
    if (found) return found;
  }
  // directory index
  for (var j = 0; j < exts.length; j++) {
    var idx = bare + '/index' + exts[j];
    var fi = Object.keys(__files).find(function(k) {
      return k.toLowerCase() === idx.toLowerCase();
    });
    if (fi) return fi;
  }
  return null;
}

function __require(mod) {
  if (mod === 'react' || mod === 'React') return React;
  if (mod === 'react-dom' || mod === 'react-dom/client') return {
    createRoot: function(el) { return ReactDOM.createRoot(el); },
    render: function(el, c) { ReactDOM.createRoot(c).render(el); }
  };
  var key = __resolve(mod);
  if (!key) { console.warn('[Preview] Module not found:', mod); return {}; }
  if (__modules[key]) return __modules[key].exports;
  if (__compiling[key]) return __modules[key] ? __modules[key].exports : {};
  __compiling[key] = true;
  var module = { exports: {} };
  __modules[key] = module;
  try {
    var compiled = Babel.transform(__files[key], {
      presets: [['env', { modules: 'commonjs', targets: { esmodules: true } }], 'react'],
      filename: key
    }).code;
    var fn = new Function('require', 'module', 'exports', 'React', compiled);
    fn(__require, module, module.exports, React);
  } catch(e) {
    console.error('[Preview] Compile error in ' + key + ':', e.message);
    module.exports.__error = e.message;
  }
  delete __compiling[key];
  return module.exports;
}

function __showError(msg) {
  document.getElementById('root').innerHTML =
    '<div style="color:#f87171;padding:20px;font-family:monospace;font-size:13px;white-space:pre-wrap;background:#1a0000;min-height:100vh">' +
    '<b>⚠ Erreur preview</b>\\n\\n' + String(msg).replace(/</g,'&lt;') + '</div>';
}

window.addEventListener('load', function() {
  if (typeof React === 'undefined' || typeof Babel === 'undefined') {
    __showError('Chargement React/Babel échoué.\\nVérifiez votre connexion internet puis rafraîchissez.');
    return;
  }
  try {
    Object.keys(__files).forEach(function(k) { __require(k); });

    var priority = ['App.jsx','App.tsx','app.jsx','app.tsx','index.jsx','index.tsx'];
    var AppComponent = null;
    for (var i = 0; i < priority.length; i++) {
      var m = __modules[priority[i]];
      if (m && m.exports) {
        var exp = m.exports.default || m.exports.App || m.exports;
        if (typeof exp === 'function') { AppComponent = exp; break; }
      }
    }
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
// Fallback placeholder
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
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          className="h-full w-full border-0"
          style={{ background: "#0b1220" }}
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
