import { useState } from "react";
import {
  ChevronDown,
  Plus,
  Download,
  FileCode,
  Trash2,
  Pencil,
  Save,
} from "lucide-react";
import type { Project } from "@/store/projects";
import { useProjectStore } from "@/store/projects";
import { saveTextToDevice, saveZipToDevice } from "@/lib/device-save";
import { toast } from "sonner";

export function ExplorerPanel({ project }: { project: Project }) {
  const { openFile, addFile, deleteFile, renameFile } = useProjectStore();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-semibold tracking-[0.25em] text-muted-foreground">
          EXPLORER
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            className="rounded p-1 hover:bg-secondary hover:text-foreground"
            aria-label="Export project as ZIP"
            title="Save project to device (.zip)"
            onClick={async () => {
              try {
                const msg = await saveZipToDevice(
                  `${project.name}.zip`,
                  project.files.map((f) => ({ path: f.path, content: f.content })),
                );
                toast.success(msg);
              } catch (e) {
                toast.error(`Save failed: ${(e as Error).message}`);
              }
            }}
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            className="rounded p-1 hover:bg-secondary hover:text-foreground"
            aria-label="New file"
            onClick={() => {
              const name = prompt("New file name (e.g. App.jsx)");
              if (name) addFile(project.id, name);
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="flex items-center gap-1 rounded px-2 py-1 text-sm font-bold">
          <ChevronDown className="h-3 w-3" /> {project.name.toUpperCase()}
        </div>
        <ul className="mt-1 space-y-0.5">
          {project.files.map((f) => (
            <li key={f.id} className="group flex items-center gap-2 rounded pl-6 pr-2 hover:bg-secondary">
              <FileCode className="h-4 w-4 text-primary/80" />
              {renaming === f.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (renameValue.trim()) renameFile(project.id, f.id, renameValue.trim());
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="flex-1 bg-transparent py-1 text-sm outline-none"
                />
              ) : (
                <button
                  onClick={() => openFile(project.id, f.id)}
                  className="flex-1 truncate py-1 text-left text-sm"
                >
                  {f.name}
                </button>
              )}
              <button
                onClick={async () => {
                  try {
                    const msg = await saveTextToDevice(f.name, f.content);
                    toast.success(msg);
                  } catch (e) {
                    toast.error(`Save failed: ${(e as Error).message}`);
                  }
                }}
                className="opacity-0 group-hover:opacity-100"
                aria-label="Save file to device"
                title="Save file to device"
              >
                <Save className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
              </button>
              <button
                onClick={() => {
                  setRenaming(f.id);
                  setRenameValue(f.name);
                }}
                className="opacity-0 group-hover:opacity-100"
                aria-label="Rename"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete ${f.name}?`)) deleteFile(project.id, f.id);
                }}
                className="opacity-0 group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}