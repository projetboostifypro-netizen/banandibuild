import { Search, Sparkles, Zap, Waves, Atom, Download } from "lucide-react";
import { useState } from "react";

const EXTS = [
  {
    name: "Prettier - Code formatter",
    desc: "Code formatter using prettier",
    tags: ["Web", "React", "Node", "TypeScript"],
    downloads: "38.4M",
    rating: 4.8,
    icon: <Sparkles className="h-6 w-6 text-fuchsia-400" />,
  },
  {
    name: "ESLint",
    desc: "Integrates ESLint JavaScript into VS Code.",
    tags: ["JavaScript", "TypeScript", "React"],
    downloads: "30.1M",
    rating: 4.6,
    icon: <Zap className="h-6 w-6 text-amber-400" />,
  },
  {
    name: "Tailwind CSS IntelliSense",
    desc: "Intelligent Tailwind CSS tooling for VS Code",
    tags: ["HTML", "React", "Vue", "Next.js"],
    downloads: "10.2M",
    rating: 4.9,
    icon: <Waves className="h-6 w-6 text-cyan-400" />,
  },
  {
    name: "React Snippets",
    desc: "Handy React code snippets for productivity",
    tags: ["React", "JSX"],
    downloads: "5.1M",
    rating: 4.7,
    icon: <Atom className="h-6 w-6 text-sky-400" />,
  },
];

export function ExtensionsPanel() {
  const [q, setQ] = useState("");
  const list = EXTS.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 text-xs font-semibold tracking-[0.25em] text-muted-foreground">
        EXTENSIONS
      </div>
      <div className="px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Extensions in Marketplace"
            className="w-full rounded-lg border border-border bg-secondary py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 px-4 text-xs font-semibold tracking-[0.15em] text-muted-foreground">
        RECOMMENDED
        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary">
          {list.length}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {list.map((e) => (
          <div
            key={e.name}
            className="rounded-xl border border-border bg-card p-3"
          >
            <div className="flex gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                {e.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{e.name}</div>
                <div className="text-xs text-muted-foreground">{e.desc}</div>
                <div className="mt-1 truncate text-xs text-primary">
                  For: {e.tags.join(", ")}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                ⇩ {e.downloads} · ★ {e.rating}
              </span>
              <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110">
                <Download className="h-3.5 w-3.5" /> Install
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}