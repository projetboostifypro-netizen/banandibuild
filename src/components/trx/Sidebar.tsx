import {
  Home,
  Files,
  Search,
  GitBranch,
  Blocks,
  Crown,
  Terminal,
  Settings,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";

type Panel = "explorer" | "search" | "scm" | "extensions" | "settings";

const items: { id: Panel; icon: ComponentType<{ className?: string }> }[] = [
  { id: "explorer", icon: Files },
  { id: "search", icon: Search },
  { id: "scm", icon: GitBranch },
  { id: "extensions", icon: Blocks },
];

export function Sidebar({
  active,
  onChange,
}: {
  active: Panel;
  onChange: (p: Panel) => void;
}) {
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center justify-between border-r border-border bg-sidebar py-3">
      <div className="flex flex-col items-center gap-1">
        <Link
          to="/"
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          aria-label="Home"
        >
          <Home className="h-5 w-5" />
        </Link>
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                isActive
                  ? "bg-primary/15 text-primary shadow-[inset_2px_0_0_var(--primary)]"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}
              aria-label={it.id}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-1">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-amber-400 hover:bg-sidebar-accent"
          aria-label="Premium"
        >
          <Crown className="h-5 w-5" />
        </button>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          aria-label="Terminal"
        >
          <Terminal className="h-5 w-5" />
        </button>
        <button
          onClick={() => onChange("settings")}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
            active === "settings"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          }`}
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}