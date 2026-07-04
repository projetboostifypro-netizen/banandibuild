import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Video } from "lucide-react";
import { Sidebar } from "@/components/trx/Sidebar";
import { ExplorerPanel } from "@/components/trx/panels/ExplorerPanel";
import { SearchPanel } from "@/components/trx/panels/SearchPanel";
import { ExtensionsPanel } from "@/components/trx/panels/ExtensionsPanel";
import { SourceControlPanel } from "@/components/trx/panels/SourceControlPanel";
import { AIPanel } from "@/components/trx/panels/AIPanel";
import { Editor } from "@/components/trx/Editor";
import { Preview } from "@/components/trx/Preview";
import { useProjectStore } from "@/store/projects";
import { Logo } from "@/components/trx/Logo";

export const Route = createFileRoute("/project/$id")({
  component: ProjectPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Link to="/" className="mt-3 inline-block text-primary underline">
          Back home
        </Link>
      </div>
    </div>
  ),
});

function ProjectPage() {
  const { id } = Route.useParams();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === id));
  const editor = useProjectStore((s) => s.editors[id]);
  const setPanel = useProjectStore((s) => s.setActivePanel);
  const setPreview = useProjectStore((s) => s.setShowPreview);

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Project not found.</p>
          <Link to="/" className="mt-3 inline-block text-primary underline">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  const activePanel = editor?.activePanel ?? "explorer";
  const showPreview = editor?.showPreview ?? false;
  const activeFile = project.files.find((f) => f.id === editor?.activeFileId);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-sidebar px-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          <Logo size={20} />
          <span className="truncate">{project.name}</span>
        </Link>
        <div className="truncate text-sm text-muted-foreground">
          {activeFile?.name ?? "—"}
        </div>
        <button
          onClick={() => setPreview(id, !showPreview)}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold transition ${
            showPreview
              ? "bg-primary text-primary-foreground"
              : "text-amber-400 hover:bg-secondary"
          }`}
        >
          <Video className="h-4 w-4" />
          Preview
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <Sidebar active={activePanel} onChange={(p) => setPanel(id, p)} />
        <div className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
          {activePanel === "explorer" && <ExplorerPanel project={project} />}
          {activePanel === "search" && <SearchPanel project={project} />}
          {activePanel === "scm" && <SourceControlPanel project={project} />}
          {activePanel === "extensions" && <ExtensionsPanel />}
          {activePanel === "copilot" && <AIPanel project={project} />}
          {activePanel === "settings" && (
            <div className="p-4 text-sm text-muted-foreground">
              Settings coming soon.
            </div>
          )}
        </div>
        <main className="flex min-w-0 flex-1 flex-col">
          <Editor project={project} />
        </main>
      </div>
      {showPreview && (
        <div className="fixed inset-0 z-40 flex flex-col bg-background">
          <header className="flex h-12 items-center justify-between border-b border-border px-4">
            <span className="font-semibold">Preview · {project.name}</span>
            <button
              onClick={() => setPreview(id, false)}
              className="rounded-md bg-secondary px-3 py-1 text-sm"
            >
              Close
            </button>
          </header>
          <div className="flex-1">
            <Preview project={project} />
          </div>
        </div>
      )}
    </div>
  );
}
