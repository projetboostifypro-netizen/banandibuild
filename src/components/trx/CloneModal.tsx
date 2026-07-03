import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/projects";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function CloneModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const create = useProjectStore((s) => s.createProject);
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle>Clone Git Repository</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="https://github.com/user/repo.git"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Real Git clone requires a backend proxy. V1 creates a placeholder project stub with the
            repo name.
          </p>
          <Button
            className="w-full"
            disabled={!url.trim()}
            onClick={() => {
              const name =
                url
                  .trim()
                  .replace(/\.git$/, "")
                  .split("/")
                  .pop() || "cloned-project";
              const p = create(name, "blank");
              toast.success(`Cloned stub for ${name}`);
              onOpenChange(false);
              navigate({ to: "/project/$id", params: { id: p.id } });
            }}
          >
            Clone
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}