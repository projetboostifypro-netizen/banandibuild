import { useMemo, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Trash2,
  FilePlus,
  Loader2,
  Key,
  Eye,
  EyeOff,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Project } from "@/store/projects";
import { useProjectStore } from "@/store/projects";
import { useAIStore } from "@/store/ai";
import { chatCompleteStream, extractFiles, type ChatMessage } from "@/lib/ai-client";
import { toast } from "sonner";

const MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o mini (rapide)" },
  { value: "gpt-4o", label: "GPT-4o (puissant)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (économique)" },
];

const SYSTEM_PROMPT = `Tu es Trx Copilot, un assistant IA de programmation dans un IDE mobile.
Tu es l'équivalent de GitHub Copilot dans VS Code, mais en version mobile.

Règles:
- Réponds en français si l'utilisateur écrit en français.
- Quand tu crées ou modifies des fichiers, utilise TOUJOURS des blocs de code fencés avec le nom du fichier:
  \`\`\`tsx App.tsx
  ...code complet...
  \`\`\`
- Préfère des fichiers COMPLETS pour que l'IDE puisse les enregistrer directement.
- Explique brièvement ce que tu as modifié après le code.
- Pour les bugs: identifie la cause racine, propose la correction avec le fichier complet.`;

// ── API Key Setup Screen ──────────────────────────────────────────────────────
function ApiKeySetup({ onSave }: { onSave: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
        <Key className="h-7 w-7 text-primary" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground">Configurer OpenAI</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Entre ta clé API OpenAI pour activer Trx Copilot. Elle est stockée
          uniquement sur cet appareil.
        </p>
      </div>
      <div className="w-full space-y-2">
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background">
          <input
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
            autoComplete="off"
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            className="px-3 text-muted-foreground"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          onClick={() => {
            if (key.trim().startsWith("sk-")) {
              onSave(key.trim());
            } else {
              toast.error("La clé doit commencer par sk-");
            }
          }}
          disabled={!key.trim()}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Activer Copilot
        </button>
        <p className="text-center text-[10px] text-muted-foreground">
          Génère ta clé sur{" "}
          <span className="text-primary">platform.openai.com/api-keys</span>
        </p>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export function AIPanel({ project }: { project: Project }) {
  const { model, apiKey, history, appendMessage, clearHistory, setApiKey, setModel, getResolvedApiKey } =
    useAIStore();
  const addFile = useProjectStore((s) => s.addFile);
  const updateFile = useProjectStore((s) => s.updateFile);
  const editors = useProjectStore((s) => s.editors[project.id]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages: ChatMessage[] = history[project.id] ?? [];
  const resolvedKey = getResolvedApiKey();

  const activeFile = useMemo(() => {
    const activeId = editors?.activeFileId;
    return activeId ? project.files.find((f) => f.id === activeId) : undefined;
  }, [editors?.activeFileId, project.files]);

  const fileList = useMemo(
    () => project.files.map((f) => `- ${f.path}`).join("\n"),
    [project.files],
  );

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    appendMessage(project.id, userMsg);
    setInput("");
    setLoading(true);
    setStreamingContent("");

    abortRef.current = new AbortController();

    try {
      // Build context: include active file content if available
      const activeFileContext = activeFile
        ? `\nFichier actif: ${activeFile.path}\n\`\`\`${activeFile.language}\n${activeFile.content.slice(0, 8000)}\n\`\`\``
        : "";

      const context: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content: `Projet: ${project.name}\nFichiers:\n${fileList}${activeFileContext}`,
        },
        ...messages,
        userMsg,
      ];

      let reply = "";
      await chatCompleteStream(
        resolvedKey,
        model,
        context,
        (delta) => {
          reply += delta;
          setStreamingContent(reply);
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        },
        abortRef.current.signal,
      );

      appendMessage(project.id, { role: "assistant", content: reply });
      setStreamingContent("");
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error(e instanceof Error ? e.message : "Requête IA échouée");
      }
      setStreamingContent("");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function applyBlock(path: string, content: string) {
    const existing = project.files.find((f) => f.path === path || f.name === path);
    if (existing) {
      updateFile(project.id, existing.id, content);
      toast.success(`✅ ${path} mis à jour`);
    } else {
      addFile(project.id, path);
      setTimeout(() => {
        const s = useProjectStore.getState();
        const p = s.projects.find((pp) => pp.id === project.id);
        const f = p?.files.find((ff) => ff.name === path || ff.path === path);
        if (f) s.updateFile(project.id, f.id, content);
      }, 0);
      toast.success(`✅ ${path} créé`);
    }
  }

  // No API key — show setup screen
  if (!resolvedKey) {
    return <ApiKeySetup onSave={setApiKey} />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Copilot
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="rounded p-1 hover:bg-secondary"
            aria-label="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
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

      {/* Settings drawer */}
      {showSettings && (
        <div className="shrink-0 border-b border-border bg-sidebar/60 p-3 text-xs">
          <div className="space-y-2">
            <label className="block text-muted-foreground">Modèle</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setApiKey("");
                setShowSettings(false);
              }}
              className="w-full rounded border border-destructive/40 py-1.5 text-destructive hover:bg-destructive/10"
            >
              Supprimer la clé API
            </button>
          </div>
        </div>
      )}

      {/* Active file context badge */}
      {activeFile && (
        <div className="shrink-0 border-b border-border bg-primary/5 px-3 py-1.5 text-[10px] text-primary">
          Contexte: <span className="font-mono font-semibold">{activeFile.name}</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        {messages.length === 0 && !streamingContent ? (
          <div className="mt-6 space-y-3 text-center text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Trx Copilot est prêt ✨</p>
            <p>Quelques idées :</p>
            {[
              "Crée un composant Button en React",
              "Corrige les bugs dans ce fichier",
              "Explique ce code et améliore-le",
              "Ajoute un formulaire de connexion",
            ].map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="mx-auto block rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-left hover:border-primary/40"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <MessageBubble key={i} m={m} onApply={applyBlock} />
            ))}
            {/* Streaming message (live) */}
            {streamingContent && (
              <div className="rounded-lg border border-border bg-secondary/40 p-2.5 text-xs">
                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> Copilot
                </div>
                <pre className="whitespace-pre-wrap break-words font-sans">{streamingContent}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-2">
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
            placeholder={`Demande à Copilot… (↵ envoyer)`}
            rows={2}
            disabled={loading}
            className="min-h-[40px] flex-1 resize-none rounded border border-border bg-background p-2 text-sm outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            onClick={loading ? () => abortRef.current?.abort() : send}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-primary-foreground transition ${
              loading ? "bg-destructive" : "bg-primary"
            } disabled:opacity-50`}
            aria-label={loading ? "Stop" : "Send"}
          >
            {loading ? (
              <span className="text-lg font-bold">■</span>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────
function MessageBubble({
  m,
  onApply,
}: {
  m: ChatMessage;
  onApply: (path: string, content: string) => void;
}) {
  const isUser = m.role === "user";
  const files = m.role === "assistant" ? extractFiles(m.content) : [];
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={`rounded-lg border text-xs ${
        isUser ? "border-primary/30 bg-primary/10" : "border-border bg-secondary/40"
      }`}
    >
      <div
        className="flex cursor-pointer items-center justify-between px-2.5 pb-1 pt-2"
        onClick={() => !isUser && setExpanded((v) => !v)}
      >
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          {isUser ? "Toi" : "Copilot"}
        </span>
        {!isUser && (
          <span className="text-muted-foreground">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        )}
      </div>
      {expanded && (
        <div className="px-2.5 pb-2.5">
          <pre className="whitespace-pre-wrap break-words font-sans">{m.content}</pre>
          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <button
                  key={i}
                  onClick={() => onApply(f.path, f.content)}
                  className="flex w-full items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-left text-[11px] text-primary hover:bg-primary/20"
                >
                  <FilePlus className="h-3 w-3 shrink-0" />
                  <span className="truncate">Appliquer → {f.path}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
