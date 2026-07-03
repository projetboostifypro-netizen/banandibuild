import { lazy, Suspense } from "react";
import type { Project } from "@/store/projects";
import { useProjectStore } from "@/store/projects";

const Monaco = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default })),
);

export function Editor({ project }: { project: Project }) {
  const editor = useProjectStore((s) => s.editors[project.id]);
  const updateFile = useProjectStore((s) => s.updateFile);
  const closeFile = useProjectStore((s) => s.closeFile);
  const openFile = useProjectStore((s) => s.openFile);

  const openIds = editor?.openFileIds ?? [];
  const activeId = editor?.activeFileId ?? null;
  const active = project.files.find((f) => f.id === activeId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex overflow-x-auto border-b border-border bg-sidebar">
        {openIds.map((id) => {
          const f = project.files.find((x) => x.id === id);
          if (!f) return null;
          const isActive = id === activeId;
          return (
            <div
              key={id}
              onClick={() => openFile(project.id, id)}
              className={`group flex cursor-pointer items-center gap-2 border-r border-border px-3 py-2 text-sm ${
                isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="truncate">{f.name}</span>
              {f.modified && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(project.id, id);
                }}
                className="opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">
        {active ? (
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading editor…</div>}>
            <Monaco
              height="100%"
              theme="vs-dark"
              language={active.language}
              value={active.content}
              onChange={(v) => updateFile(project.id, active.id, v ?? "")}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                automaticLayout: true,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                padding: { top: 12 },
              }}
            />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Select a file from the Explorer to start editing.
          </div>
        )}
      </div>
    </div>
  );
}