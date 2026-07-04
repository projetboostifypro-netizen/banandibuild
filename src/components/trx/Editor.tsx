import { useCallback, useEffect, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import type { Project } from "@/store/projects";
import { useProjectStore } from "@/store/projects";

function getExtensions(language: string) {
  switch (language) {
    case "javascript":
      return [javascript({ jsx: true })];
    case "typescript":
      return [javascript({ jsx: true, typescript: true })];
    case "html":
      return [html()];
    case "css":
      return [css()];
    case "json":
      return [json()];
    case "markdown":
      return [markdown()];
    case "python":
      return [python()];
    default:
      return [];
  }
}

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Courier New', monospace",
  },
  "&.cm-editor": {
    height: "100%",
    flex: "1",
    minHeight: "0",
  },
  ".cm-scroller": {
    overflow: "auto",
    height: "100%",
    flex: "1",
    minHeight: "0",
  },
  ".cm-content": {
    padding: "12px 0",
    minHeight: "100%",
    // Force visible text color regardless of parent theme
    caretColor: "#528bff",
  },
  ".cm-cursor": {
    borderLeftWidth: "2px",
    borderLeftColor: "#528bff",
  },
  ".cm-line": {
    padding: "0 16px",
  },
  ".cm-gutters": {
    minWidth: "40px",
    userSelect: "none",
  },
});

export function Editor({ project }: { project: Project }) {
  const editor = useProjectStore((s) => s.editors[project.id]);
  const updateFile = useProjectStore((s) => s.updateFile);
  const closeFile = useProjectStore((s) => s.closeFile);
  const openFile = useProjectStore((s) => s.openFile);
  const containerRef = useRef<HTMLDivElement>(null);

  const openIds = editor?.openFileIds ?? [];
  const activeId = editor?.activeFileId ?? null;
  const active = project.files.find((f) => f.id === activeId);

  const extensions = useMemo(
    () => [baseTheme, oneDark, ...getExtensions(active?.language ?? "")],
    [active?.language],
  );

  const onChange = useCallback(
    (value: string) => {
      if (active) updateFile(project.id, active.id, value);
    },
    [active, project.id, updateFile],
  );

  // Scroll active tab into view
  useEffect(() => {
    const tabEl = containerRef.current?.querySelector(`[data-fileid="${activeId}"]`);
    tabEl?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeId]);

  return (
    <div className="flex h-full min-h-0 flex-col" ref={containerRef}>
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-border bg-sidebar scrollbar-thin">
        {openIds.map((id) => {
          const f = project.files.find((x) => x.id === id);
          if (!f) return null;
          const isActive = id === activeId;
          return (
            <div
              key={id}
              data-fileid={id}
              onClick={() => openFile(project.id, id)}
              className={`group flex cursor-pointer items-center gap-2 border-r border-border px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="max-w-[120px] truncate">{f.name}</span>
              {f.modified && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(project.id, id);
                }}
                className="shrink-0 text-muted-foreground opacity-60 hover:opacity-100"
                aria-label="Close tab"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor area */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {active ? (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ isolation: "isolate" }}
          >
            <CodeMirror
              key={active.id}
              value={active.content}
              height="100%"
              theme={oneDark}
              extensions={extensions}
              onChange={onChange}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                autocompletion: true,
                bracketMatching: true,
                closeBrackets: true,
                foldGutter: false,
                dropCursor: false,
                allowMultipleSelections: false,
                indentOnInput: true,
                syntaxHighlighting: true,
                searchKeymap: false,
              }}
              style={{
                height: "100%",
                width: "100%",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="text-3xl">📄</div>
            <p className="text-sm text-muted-foreground">
              Sélectionne un fichier dans l'Explorateur pour commencer à coder.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
