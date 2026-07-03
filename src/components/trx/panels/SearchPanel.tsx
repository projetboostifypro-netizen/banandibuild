import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Project } from "@/store/projects";
import { useProjectStore } from "@/store/projects";

export function SearchPanel({ project }: { project: Project }) {
  const [q, setQ] = useState("");
  const openFile = useProjectStore((s) => s.openFile);
  const results = useMemo(() => {
    if (!q) return [];
    const list: { fileId: string; name: string; line: number; text: string }[] = [];
    for (const f of project.files) {
      f.content.split("\n").forEach((line, i) => {
        if (line.toLowerCase().includes(q.toLowerCase()))
          list.push({ fileId: f.id, name: f.name, line: i + 1, text: line.trim() });
      });
    }
    return list.slice(0, 200);
  }, [q, project.files]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 text-xs font-semibold tracking-[0.25em] text-muted-foreground">
        SEARCH
      </div>
      <div className="px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search across files"
            className="w-full rounded-lg border border-border bg-secondary py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {results.map((r, i) => (
          <button
            key={i}
            onClick={() => openFile(project.id, r.fileId)}
            className="block w-full rounded px-2 py-1 text-left hover:bg-secondary"
          >
            <div className="text-xs text-primary">
              {r.name}:{r.line}
            </div>
            <div className="truncate font-mono text-xs text-muted-foreground">{r.text}</div>
          </button>
        ))}
      </div>
    </div>
  );
}