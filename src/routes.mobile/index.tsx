import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import JSZip from "jszip";
import {
  Plus,
  Github,
  FileArchive,
  FolderOpen,
  Clock,
  Folder,
  Trash2,
  X,
} from "lucide-react";
import { Logo } from "@/components/trx/Logo";
import { NewProjectModal } from "@/components/trx/NewProjectModal";
import { CloneModal } from "@/components/trx/CloneModal";
import { useProjectStore } from "@/store/projects";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [newOpen, setNewOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const projects = useProjectStore((s) => s.projects);
  const importFiles = useProjectStore((s) => s.importFiles);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const navigate = useNavigate();

  async function handleZip(file: File) {
    const zip = await JSZip.loadAsync(file);
    const entries: { name: string; path: string; content: string }[] = [];
    await Promise.all(
      Object.values(zip.files).map(async (entry) => {
        if (entry.dir) return;
        const content = await entry.async("string");
        entries.push({
          name: entry.name.split("/").pop() || entry.name,
          path: entry.name,
          content,
        });
      }),
    );
    const name = file.name.replace(/\.zip$/i, "");
    const p = importFiles(name, entries);
    toast.success(`Imported ${entries.length} files`);
    navigate({ to: "/project/$id", params: { id: p.id } });
  }

  async function handleFolder(list: FileList) {
    const entries: { name: string; path: string; content: string }[] = [];
    await Promise.all(
      Array.from(list).map(async (f) => {
        const text = await f.text();
        entries.push({
          name: f.name,
          path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
          content: text,
        });
      }),
    );
    const first = list[0] as File & { webkitRelativePath?: string };
    const name = first?.webkitRelativePath?.split("/")[0] || "folder-project";
    const p = importFiles(name, entries);
    toast.success(`Opened ${entries.length} files`);
    navigate({ to: "/project/$id", params: { id: p.id } });
  }

  function handleDeleteProject(id: string, name: string) {
    setDeletingId(id);
    toast(`Delete "${name}"?`, {
      action: {
        label: "Delete",
        onClick: () => {
          deleteProject(id);
          toast.success(`"${name}" deleted`);
          setDeletingId(null);
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => setDeletingId(null),
      },
      duration: 5000,
    });
  }

  const actions = [
    {
      label: "New Project",
      icon: <Plus className="h-5 w-5" />,
      primary: true,
      onClick: () => setNewOpen(true),
    },
    {
      label: "Clone",
      icon: <Github className="h-5 w-5" />,
      onClick: () => setCloneOpen(true),
    },
    {
      label: "Import ZIP",
      icon: <FileArchive className="h-5 w-5" />,
      onClick: () => zipInput.current?.click(),
    },
    {
      label: "Open Folder",
      icon: <FolderOpen className="h-5 w-5" />,
      onClick: () => folderInput.current?.click(),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-10">
        <header className="flex items-center justify-between">
          <Logo />
          <div className="w-8" />
        </header>

        <div className="mt-10">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-primary">
            <span className="text-primary">//</span> WELCOME BACK
          </div>
          <h1 className="mt-4 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Start <span className="text-primary">Coding</span> Today
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground">
            Your workspace awaits. Open a recent project or start a new one.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-5 text-base font-semibold transition ${
                a.primary
                  ? "bg-primary text-primary-foreground shadow-[0_10px_40px_-10px_var(--primary)] hover:brightness-110"
                  : "border border-border bg-card text-foreground hover:border-primary/40"
              }`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>

        <input
          ref={zipInput}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleZip(f);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          // @ts-expect-error non-standard directory attributes
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFolder(e.target.files);
            e.target.value = "";
          }}
        />

        <section className="mt-12">
          <div className="mb-4 text-xs font-semibold tracking-[0.25em] text-muted-foreground">
            RECENT
          </div>
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No projects yet. Start a New Project to begin.
            </div>
          ) : (
            <ul className="space-y-3">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="relative overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary" />
                  <Link
                    to="/project/$id"
                    params={{ id: p.id }}
                    className="flex items-center gap-3 px-4 py-4"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-lg font-bold text-primary">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{p.name}</span>
                        {p.status === "active" && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5">
                          <Folder className="h-3 w-3" /> Local
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(p.updatedAt))} ago
                        </span>
                        <span>· {p.files.length} files</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteProject(p.id, p.name);
                      }}
                      className={`rounded-md p-2 text-muted-foreground transition hover:text-destructive ${
                        deletingId === p.id ? "text-destructive" : ""
                      }`}
                      aria-label="Delete project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <NewProjectModal open={newOpen} onOpenChange={setNewOpen} />
      <CloneModal open={cloneOpen} onOpenChange={setCloneOpen} />
    </div>
  );
}
