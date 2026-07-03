import { useState } from "react";
import { GitBranch, EyeOff, Github, RefreshCcw, Check } from "lucide-react";
import type { Project } from "@/store/projects";
import { useProjectStore } from "@/store/projects";
import { toast } from "sonner";

export function SourceControlPanel({ project }: { project: Project }) {
  const [msg, setMsg] = useState("");
  const changes = project.files.filter((f) => f.modified);
  const publish = useProjectStore((s) => s.publishToGithub);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-semibold tracking-[0.25em] text-muted-foreground">
          SOURCE CONTROL
        </div>
        <RefreshCcw className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GitBranch className="h-4 w-4 text-primary" /> {project.name}
        </div>
        {!project.publishedToGithub && (
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Local only
          </div>
        )}
      </div>

      {!project.publishedToGithub ? (
        <div className="mx-4 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 font-semibold text-amber-400">
            <EyeOff className="h-4 w-4" /> Not Published to GitHub
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            This project is only saved locally. Publish to GitHub to back up your code and
            collaborate.
          </p>
          <button
            onClick={() => {
              const url = prompt("GitHub repo URL (V1: stored locally)");
              if (url) {
                publish(project.id, url);
                toast.success("Marked as published to GitHub");
              }
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/90 px-3 py-2 text-sm font-semibold text-black hover:brightness-110"
          >
            <Github className="h-4 w-4" /> Publish to GitHub
          </button>
        </div>
      ) : (
        <div className="mx-4 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-300">
          Linked to {project.githubRepoUrl}
        </div>
      )}

      <div className="mt-6 flex gap-4 border-b border-border px-4 text-sm">
        <div className="flex items-center gap-2 border-b-2 border-primary pb-2 font-semibold">
          <GitBranch className="h-4 w-4" /> Changes
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary">
            {changes.length}
          </span>
        </div>
        <div className="pb-2 text-muted-foreground">Graph</div>
      </div>

      <div className="px-4 py-3">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Message (press Enter to commit)"
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            disabled={!msg || changes.length === 0}
            onClick={() => {
              toast.success(`Committed: ${msg}`);
              setMsg("");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Commit
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold">
            <RefreshCcw className="h-4 w-4" /> Sync
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="text-xs font-semibold tracking-[0.25em] text-muted-foreground">
          CHANGES ({changes.length})
        </div>
        <ul className="mt-2 space-y-1">
          {changes.length === 0 && (
            <li className="py-6 text-center text-xs text-muted-foreground">No changes</li>
          )}
          {changes.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-secondary">
              <span className="truncate text-sm">{f.name}</span>
              <span className="text-xs font-semibold text-emerald-400">A</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}