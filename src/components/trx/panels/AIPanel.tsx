import { useMemo, useRef, useState } from "react";
import { Send, Sparkles, Trash2, FilePlus, Settings2, Loader2 } from "lucide-react";
import type { Project } from "@/store/projects";
import { useProjectStore } from "@/store/projects";
import { useAIStore } from "@/store/ai";
import { chatComplete, extractFiles, type ChatMessage } from "@/lib/ai-client";
import { toast } from "sonner";

const SYSTEM_PROMPT = `You are Trx Copilot, an AI pair programmer inside a mobile IDE.
- Answer concisely.
- When creating or editing files, ALWAYS output fenced code blocks with a filename hint:
  \`\`\`tsx src/components/Foo.tsx
  ...code...
  \`\`\`
- Prefer complete file contents so the IDE can save them directly.`;

export function AIPanel({ project }: { project: Project }) {
  const { apiKey, model, baseURL, history, appendMessage, clearHistory, setConfig } =
    useAIStore();
  const addFile = useProjectStore((s) => s.addFile);
  const updateFile = useProjectStore((s) => s.updateFile);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(!apiKey);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = history[project.id] ?? [];

  const fileList = useMemo(
    () => project.files.map((f) => `- ${f.path}`).join("\n"),
    [project.files],
  );

  async function send() {
    const text = input.trim();
    if (!text) return;
    if (!apiKey) {
      toast.error("Add your Lovable API key in settings first.");
      setShowSettings(true);
      return;
    }
    const userMsg: ChatMessage = { role: "user", content: text };
    appendMessage(project.id, userMsg);
    setInput("");
    setLoading(true);
    try {
      const context: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content: `Current project: ${project.name}\nFiles:\n${fileList}`,
        },
        ...messages,
        userMsg,
      ];
      const reply = await chatComplete({ apiKey, model, baseURL }, context);
      appendMessage(project.id, { role: "assistant", content: reply });
      setTimeout(() => scrollRef.current?.scrollTo({ top: 1e9 }), 50);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  function applyBlock(path: string, content: string) {
    const existing = project.files.find((f) => f.path === path || f.name === path);
    if (existing) {
      updateFile(project.id, existing.id, content);
      toast.success(`Updated ${path}`);
    } else {
      addFile(project.id, path);
      // find the newly added file to write content
      setTimeout(() => {
        const s = useProjectStore.getState();
        const p = s.projects.find((pp) => pp.id === project.id);
        const f = p?.files.find((ff) => ff.name === path || ff.path === path);
        if (f) s.updateFile(project.id, f.id, content);
      }, 0);
      toast.success(`Created ${path}`);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center justify-between border-b border-border px-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Copilot
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="rounded p-1 hover:bg-secondary"
            aria-label="AI Settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => clearHistory(project.id)}
            className="rounded p-1 hover:bg-secondary"
            aria-label="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="border-b border-border bg-secondary/30 p-3 text-xs">
          <label className="mb-1 block text-muted-foreground">Lovable API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setConfig({ apiKey: e.target.value })}
            placeholder="sk-..."
            className="mb-2 w-full rounded border border-border bg-background px-2 py-1"
          />
          <label className="mb-1 block text-muted-foreground">Model</label>
          <input
            value={model}
            onChange={(e) => setConfig({ model: e.target.value })}
            className="mb-2 w-full rounded border border-border bg-background px-2 py-1"
          />
          <p className="text-[10px] text-muted-foreground">
            Get a key from lovable.dev → Settings → AI Gateway. Key is stored locally on your device.
          </p>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
        {messages.length === 0 ? (
          <div className="mt-8 text-center text-xs text-muted-foreground">
            Ask Trx Copilot to write code, refactor, or create files.
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                m={m}
                onApply={applyBlock}
              />
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border p-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask Copilot… (Enter to send)"
            rows={2}
            className="min-h-[40px] flex-1 resize-none rounded border border-border bg-background p-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={send}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Send"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  onApply,
}: {
  m: ChatMessage;
  onApply: (path: string, content: string) => void;
}) {
  const isUser = m.role === "user";
  const files = m.role === "assistant" ? extractFiles(m.content) : [];
  return (
    <div
      className={`rounded-lg border p-2.5 text-xs ${
        isUser
          ? "border-primary/30 bg-primary/10"
          : "border-border bg-secondary/40"
      }`}
    >
      <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
        {isUser ? "You" : "Copilot"}
      </div>
      <pre className="whitespace-pre-wrap break-words font-sans">{m.content}</pre>
      {files.length > 0 && (
        <div className="mt-2 space-y-1">
          {files.map((f, i) => (
            <button
              key={i}
              onClick={() => onApply(f.path, f.content)}
              className="flex w-full items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-left text-[11px] text-primary hover:bg-primary/20"
            >
              <FilePlus className="h-3 w-3" />
              Apply → {f.path}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}