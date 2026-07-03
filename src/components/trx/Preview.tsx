import { useMemo } from "react";
import type { Project } from "@/store/projects";

function buildSrcDoc(project: Project): string {
  const html = project.files.find((f) => f.name.toLowerCase() === "index.html");
  const css = project.files
    .filter((f) => f.name.toLowerCase().endsWith(".css"))
    .map((f) => f.content)
    .join("\n");
  const js = project.files
    .filter((f) => /\.(m?js|jsx)$/i.test(f.name) && f.name.toLowerCase() !== "index.jsx")
    .map((f) => f.content)
    .join("\n");
  const entry = project.files.find((f) => f.name.toLowerCase() === "index.jsx");

  if (project.type === "react" || entry) {
    const app = project.files.find((f) => f.name.toLowerCase() === "app.jsx");
    const combined = `${app?.content ?? ""}\n${entry?.content ?? ""}`
      .replace(/import\s+[^;]+;?/g, "")
      .replace(/export\s+default\s+/g, "window.App = ");
    return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head>
<body><div id="root"></div>
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel" data-presets="react">
const { useState, useEffect } = React;
${combined}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(window.App));
</script></body></html>`;
  }

  if (html) {
    let content = html.content;
    if (css) content = content.replace(/<\/head>/i, `<style>${css}</style></head>`);
    if (js) content = content.replace(/<\/body>/i, `<script>${js}</script></body>`);
    return content;
  }
  return `<!doctype html><html><body style="background:#0b1220;color:#94a3b8;font-family:system-ui;display:grid;place-items:center;min-height:100vh"><p>No preview available for this project.</p></body></html>`;
}

export function Preview({ project }: { project: Project }) {
  const srcDoc = useMemo(() => buildSrcDoc(project), [project]);
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-4 py-2 text-xs font-semibold tracking-[0.25em] text-muted-foreground">
        PREVIEW
      </div>
      <iframe
        title="Preview"
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        className="h-full w-full flex-1 bg-white"
      />
    </div>
  );
}