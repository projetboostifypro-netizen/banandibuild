import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProjectStore, type ProjectType } from "@/store/projects";
import { Atom, FileCode, FileText } from "lucide-react";

export function NewProjectModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("react");
  const create = useProjectStore((s) => s.createProject);
  const navigate = useNavigate();

  const templates: { id: ProjectType; label: string; icon: React.ReactNode }[] = [
    { id: "react", label: "React", icon: <Atom className="h-5 w-5 text-primary" /> },
    { id: "html", label: "HTML / CSS / JS", icon: <FileCode className="h-5 w-5 text-primary" /> },
    { id: "blank", label: "Blank", icon: <FileText className="h-5 w-5 text-primary" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              PROJECT NAME
            </label>
            <Input
              placeholder="my-app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">TEMPLATE</label>
            <div className="grid grid-cols-3 gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition ${
                    type === t.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary hover:border-primary/50"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            disabled={!name.trim()}
            onClick={() => {
              const p = create(name.trim(), type);
              onOpenChange(false);
              navigate({ to: "/project/$id", params: { id: p.id } });
            }}
          >
            Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}