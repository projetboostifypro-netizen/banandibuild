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
  ChevronRight,
  Check,
  X,
  RefreshCw,
  FileEdit,
} from "lucide-react";
import type { Project, ProjectFile } from "@/store/projects";
import { useProjectStore } from "@/store/projects";
import { useAIStore } from "@/store/ai";
import {
  chatCompleteStream,
  extractFiles,
  PROVIDER_CONFIGS,
  type ChatMessage,
  type AIProvider,
  type ParsedFile,
  type ProviderConfig,
} from "@/lib/ai-client";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// SYSTEM PROMPT — strict file naming + professional design rules
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Tu es Trx Copilot, un assistant de programmation expert intégré dans un IDE mobile.

═══ RÈGLES ABSOLUES — NE JAMAIS ENFREINDRE ═══

1. NOMMAGE DES FICHIERS (critique):
   - Utilise TOUJOURS le format: \`\`\`jsx App.jsx   (langue + nom EXACT du fichier)
   - Le nom du fichier doit correspondre EXACTEMENT à ce qui existe dans le projet
   - Si tu modifies App.jsx, le bloc doit être \`\`\`jsx App.jsx — pas snippet, pas nouveau fichier
   - JAMAIS de noms génériques type "snippet-1.html", "component.jsx", "style.css"
   - Si le fichier à modifier est dans la liste du projet, utilise son nom exact

2. MODIFICATION vs CRÉATION:
   - Quand l'utilisateur dit "modifie", "améliore", "change", "ajoute dans" → MODIFIER le fichier existant
   - Inclure le fichier COMPLET, pas juste les parties modifiées
   - Ne JAMAIS créer un nouveau fichier si l'utilisateur veut modifier un existant

3. DESIGNS PROFESSIONNELS (obligatoire):
   - Chaque page HTML/CSS doit avoir un design moderne et professionnel
   - Utilise des dégradés, glassmorphism, ombres, animations CSS
   - Palette sombre élégante ou palette colorée audacieuse — jamais de blanc plat
   - Police Google Fonts importée (Inter, Poppins, Space Grotesk…)
   - Hover effects, transitions fluides, micro-interactions
   - Responsive mobile-first
   - Jamais de HTML/CSS basique ou non stylisé

═══ FORMAT OBLIGATOIRE ═══

\`\`\`html index.html
...code complet...
\`\`\`

\`\`\`css App.css
...code complet...
\`\`\`

\`\`\`jsx App.jsx
...code complet...
\`\`\`

═══ AUTRES RÈGLES ═══
- Réponds en français si l'utilisateur écrit en français
- Explique brièvement APRÈS le code ce qui a été modifié
- Pour les bugs: identifie la cause racine, donne le fichier complet corrigé`;

// ---------------------------------------------------------------------------
// Markdown renderer with syntax-highlighted code blocks
// ---------------------------------------------------------------------------
function MarkdownContent({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  const codeBlockRe = /```([\w+-]*)(?:\s+([\w./\-]+\.[a-zA-Z0-9]{1,10}))?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRe.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before) {
      parts.push(
        <span key={key++} className="whitespace-pre-wrap break-words">
          {before}
        </span>,
      );
    }

    const lang = match[1] || "";
    const filename = match[2] || "";
    const code = match[3] ?? "";

    parts.push(
      <div key={key++} className="my-2 overflow-hidden rounded-md border border-border">
        {(lang || filename) && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2.5 py-1 text-[10px] text-muted-foreground">
            {lang && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary">
                {lang}
              </span>
            )}
            {filename && <span className="font-mono text-foreground/80 font-semibold">{filename}</span>}
          </div>
        )}
        <pre className="overflow-x-auto bg-[oklch(0.12_0.01_260)] p-3 font-mono text-[11px] leading-relaxed text-[oklch(0.92_0.02_245)]">
          {code}
        </pre>
      </div>,
    );

    lastIndex = match.index + match[0].length;
  }

  const tail = content.slice(lastIndex);
  if (tail) {
    parts.push(
      <span key={key++} className="whitespace-pre-wrap break-words">
        {tail}
      </span>,
    );
  }

  return <div className="text-xs leading-relaxed">{parts}</div>;
}

// ---------------------------------------------------------------------------
// Provider icons
// ---------------------------------------------------------------------------
const PROVIDER_ICONS: Record<AIProvider, string> = {
  openai: "🤖",
  groq: "⚡",
  gemini: "✨",
  claude: "🧠",
};

// ---------------------------------------------------------------------------
// API Key Setup Screen (first-run)
// ---------------------------------------------------------------------------
function ApiKeySetup({ onSave }: { onSave: (provider: AIProvider, key: string) => void }) {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>("openai");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const config = PROVIDER_CONFIGS[selectedProvider];

  function handleSave() {
    const trimmed = key.trim();
    if (!trimmed) return;
    if (config.keyPrefix && !trimmed.startsWith(config.keyPrefix)) {
      toast.error(`La clé ${config.label} doit commencer par "${config.keyPrefix}"`);
      return;
    }
    onSave(selectedProvider, trimmed);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 overflow-y-auto p-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
        <Key className="h-7 w-7 text-primary" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground">Configurer un fournisseur IA</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Choisissez un fournisseur et entrez votre clé API.
          <br />
          Stockée uniquement sur cet appareil.
        </p>
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        {(Object.values(PROVIDER_CONFIGS) as ProviderConfig[]).map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelectedProvider(p.id); setKey(""); }}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs transition ${
              selectedProvider === p.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            <span className="text-xl">{PROVIDER_ICONS[p.id]}</span>
            <span className="font-semibold">{p.label}</span>
          </button>
        ))}
      </div>
      <div className="w-full space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Clé API {config.label}
        </label>
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background">
          <input
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={config.keyPlaceholder}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none"
            autoComplete="off"
          />
          <button onClick={() => setShowKey((v) => !v)} className="px-3 text-muted-foreground" type="button">
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!key.trim()}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Activer {config.label}
        </button>
        <p className="text-center text-[10px] text-muted-foreground">
          {selectedProvider === "openai" && "→ platform.openai.com/api-keys"}
          {selectedProvider === "groq" && "→ console.groq.com/keys"}
          {selectedProvider === "gemini" && "→ aistudio.google.com/app/apikey"}
          {selectedProvider === "claude" && "→ console.anthropic.com/settings/keys"}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart file apply — match AI-generated code to the right existing file
// ---------------------------------------------------------------------------
function smartMatch(
  parsed: ParsedFile,
  projectFiles: ProjectFile[],
  activeFileId: string | null | undefined,
): ProjectFile | null {
  const targetPath = parsed.path.toLowerCase();

  // 1. Exact case-insensitive match (always attempted, named or snippet)
  const exact = projectFiles.find(
    (f) => f.path.toLowerCase() === targetPath || f.name.toLowerCase() === targetPath,
  );
  if (exact) return exact;

  // 2. Extension-based fallback — ONLY for true snippets (no filename from AI).
  //    Skip for named files that simply don't exist yet (user may intend a new file).
  if (!parsed.isSnippet) return null;

  const ext = parsed.path.split(".").pop()?.toLowerCase() ?? "";
  const byExt = projectFiles.filter(
    (f) => f.name.split(".").pop()?.toLowerCase() === ext,
  );

  // 2a. Active file matches extension → prefer it (user is likely editing it)
  if (activeFileId) {
    const activeMatch = byExt.find((f) => f.id === activeFileId);
    if (activeMatch) return activeMatch;
  }

  // 2b. Only one file with that extension → safe to auto-apply
  if (byExt.length === 1) return byExt[0];

  return null;
}

// ---------------------------------------------------------------------------
// File picker modal — shown when there are multiple possible targets
// ---------------------------------------------------------------------------
function FilePicker({
  options,
  onPick,
  onClose,
  onCreateNew,
}: {
  options: ProjectFile[];
  onPick: (file: ProjectFile) => void;
  onClose: () => void;      // dismiss only — no side effect
  onCreateNew: () => void;  // create a brand-new file
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xs rounded-xl border border-border bg-sidebar shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Quel fichier modifier ?</span>
          {/* X = close modal only, does NOT create a file */}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-2">
          {options.map((f) => (
            <button
              key={f.id}
              onClick={() => onPick(f)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-secondary"
            >
              <FileEdit className="h-4 w-4 shrink-0 text-primary" />
              <span className="font-mono font-medium text-foreground">{f.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{f.path}</span>
            </button>
          ))}
          <div className="mt-1 flex gap-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Fermer
            </button>
            <button
              onClick={onCreateNew}
              className="flex-1 rounded-lg py-2 text-xs text-primary hover:bg-primary/10"
            >
              Créer nouveau fichier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ProviderConfig is imported above with the other @/lib/ai-client types

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------
export function AIPanel({ project }: { project: Project }) {
  const {
    provider,
    model,
    apiKeys,
    history,
    appendMessage,
    clearHistory,
    setApiKey,
    removeApiKey,
    setProvider,
    setModel,
    getActiveApiKey,
  } = useAIStore();
  const addFile = useProjectStore((s) => s.addFile);
  const updateFile = useProjectStore((s) => s.updateFile);
  const editors = useProjectStore((s) => s.editors[project.id]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [pickerState, setPickerState] = useState<{
    options: ProjectFile[];
    content: string;
    originalPath: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages: ChatMessage[] = history[project.id] ?? [];
  const activeApiKey = getActiveApiKey();
  const config = PROVIDER_CONFIGS[provider];

  const activeFile = useMemo(() => {
    const activeId = editors?.activeFileId;
    return activeId ? project.files.find((f) => f.id === activeId) : undefined;
  }, [editors?.activeFileId, project.files]);

  const fileList = useMemo(
    () => project.files.map((f) => `- ${f.path}`).join("\n"),
    [project.files],
  );

  // ── Send message ──────────────────────────────────────────────────────────
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
      const activeFileContext = activeFile
        ? `\nFichier actif ouvert (le fichier que l'utilisateur édite en ce moment): ${activeFile.path}\n\`\`\`${activeFile.language}\n${activeFile.content.slice(0, 8000)}\n\`\`\``
        : "";

      const context: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content: `PROJET: "${project.name}"

FICHIERS EXISTANTS dans ce projet (utilise EXACTEMENT ces noms dans tes blocs de code):
${fileList}
${activeFileContext}

RAPPEL CRITIQUE: Si tu modifies un fichier existant, ton bloc de code DOIT avoir le même nom que le fichier dans la liste ci-dessus. Exemple: si App.jsx est dans la liste, le bloc doit être \`\`\`jsx App.jsx`,
        },
        ...messages,
        userMsg,
      ];

      let reply = "";
      await chatCompleteStream(
        activeApiKey,
        model,
        context,
        (delta) => {
          reply += delta;
          setStreamingContent(reply);
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        },
        abortRef.current.signal,
        provider,
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

  // ── Smart apply: tries to update existing file before creating new one ────
  function applyBlock(parsed: ParsedFile) {
    const { path, content, isSnippet } = parsed;

    // Find best matching existing file
    const match = smartMatch(parsed, project.files, editors?.activeFileId);

    if (match) {
      // Exact or auto-match → update directly
      updateFile(project.id, match.id, content);
      const label = match.path !== path ? `${match.name} (correspondance auto)` : match.name;
      toast.success(`✅ ${label} mis à jour`);
      return;
    }

    // Multiple files with same extension → show picker
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const byExt = project.files.filter(
      (f) => f.name.split(".").pop()?.toLowerCase() === ext,
    );
    if (isSnippet && byExt.length > 1) {
      setPickerState({ options: byExt, content, originalPath: path });
      return;
    }

    // No match — create new file
    addFile(project.id, path);
    setTimeout(() => {
      const s = useProjectStore.getState();
      const p = s.projects.find((pp) => pp.id === project.id);
      const f = p?.files.find((ff) => ff.name === path || ff.path === path);
      if (f) s.updateFile(project.id, f.id, content);
    }, 0);
    toast.success(`✅ ${path} créé`);
  }

  function confirmPick(file: ProjectFile) {
    if (!pickerState) return;
    updateFile(project.id, file.id, pickerState.content);
    toast.success(`✅ ${file.name} mis à jour`);
    setPickerState(null);
  }

  function closePicker() {
    // Just dismiss the modal — no file action
    setPickerState(null);
  }

  function createNewFromPicker() {
    if (!pickerState) return;
    const { content, originalPath } = pickerState;
    addFile(project.id, originalPath);
    setTimeout(() => {
      const s = useProjectStore.getState();
      const p = s.projects.find((pp) => pp.id === project.id);
      const f = p?.files.find((ff) => ff.name === originalPath || ff.path === originalPath);
      if (f) s.updateFile(project.id, f.id, content);
    }, 0);
    toast.success(`✅ ${originalPath} créé`);
    setPickerState(null);
  }

  // ── Derived: label for apply button ──────────────────────────────────────
  function getApplyLabel(parsed: ParsedFile): string {
    const match = smartMatch(parsed, project.files, editors?.activeFileId);
    if (match) {
      const isAuto = match.path.toLowerCase() !== parsed.path.toLowerCase();
      return isAuto
        ? `Mettre à jour ${match.name} ↗`
        : `Mettre à jour ${match.name}`;
    }
    if (parsed.isSnippet) {
      const ext = parsed.path.split(".").pop()?.toLowerCase() ?? "";
      const byExt = project.files.filter(
        (f) => f.name.split(".").pop()?.toLowerCase() === ext,
      );
      if (byExt.length > 1) return `Choisir le fichier .${ext} à modifier…`;
    }
    return `Créer ${parsed.path}`;
  }

  // No API key — show setup screen
  if (!activeApiKey) {
    return (
      <ApiKeySetup
        onSave={(prov, key) => {
          setApiKey(prov, key);
          setProvider(prov);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* File picker modal */}
      {pickerState && (
        <FilePicker
          options={pickerState.options}
          onPick={confirmPick}
          onClose={closePicker}
          onCreateNew={createNewFromPicker}
        />
      )}

      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>{PROVIDER_ICONS[provider]} Copilot</span>
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
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-muted-foreground">Fournisseur</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.values(PROVIDER_CONFIGS) as ProviderConfig[]).map((p) => {
                  const hasKey = !!apiKeys[p.id]?.trim();
                  return (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-left transition ${
                        provider === p.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <span>{PROVIDER_ICONS[p.id]}</span>
                      <span className="flex-1 truncate text-[10px]">{p.label}</span>
                      {hasKey && <Check className="h-2.5 w-2.5 text-green-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-muted-foreground">Modèle ({config.label})</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none"
              >
                {config.models.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-muted-foreground">Clés API configurées</label>
              <div className="space-y-1">
                {(Object.keys(PROVIDER_CONFIGS) as AIProvider[]).map((prov) => {
                  if (!apiKeys[prov]?.trim()) return null;
                  return (
                    <div
                      key={prov}
                      className="flex items-center justify-between rounded border border-border bg-background px-2 py-1"
                    >
                      <span className="flex items-center gap-1 text-[10px]">
                        <span>{PROVIDER_ICONS[prov]}</span>
                        <span className="text-foreground">{PROVIDER_CONFIGS[prov].label}</span>
                        <span className="text-green-400">✓</span>
                      </span>
                      <button
                        onClick={() => removeApiKey(prov)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {!apiKeys[provider]?.trim() && (
              <AddKeyInline provider={provider} onSave={(key) => setApiKey(provider, key)} />
            )}
          </div>
        </div>
      )}

      {/* Active file badge */}
      {activeFile && (
        <div className="shrink-0 border-b border-border bg-primary/5 px-3 py-1.5 text-[10px] text-primary">
          Contexte: <span className="font-mono font-semibold">{activeFile.name}</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        {messages.length === 0 && !streamingContent ? (
          <div className="mt-6 space-y-3 text-center text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">
              {PROVIDER_ICONS[provider]} Trx Copilot prêt
            </p>
            <p className="text-[10px]">
              {config.label} · {model}
            </p>
            <p>Quelques idées :</p>
            {[
              "Crée une page d'accueil avec design pro",
              "Modifie App.jsx pour ajouter une navbar",
              "Améliore le CSS avec un design moderne",
              "Corrige les bugs dans ce fichier",
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
              <MessageBubble
                key={i}
                m={m}
                projectFiles={project.files}
                activeFileId={editors?.activeFileId}
                onApply={applyBlock}
                getLabel={getApplyLabel}
              />
            ))}
            {streamingContent && (
              <div className="rounded-lg border border-border bg-secondary/40 p-2.5 text-xs">
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> Copilot
                </div>
                <MarkdownContent content={streamingContent} />
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
            placeholder="Demande à Copilot… (↵ envoyer)"
            rows={2}
            disabled={loading}
            className="min-h-[40px] flex-1 resize-none rounded border border-border bg-background p-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            onClick={loading ? () => abortRef.current?.abort() : send}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-primary-foreground transition ${
              loading ? "bg-destructive" : "bg-primary"
            }`}
            aria-label={loading ? "Stop" : "Send"}
          >
            {loading ? <span className="text-lg font-bold">■</span> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline add key (in settings)
// ---------------------------------------------------------------------------
function AddKeyInline({
  provider,
  onSave,
}: {
  provider: AIProvider;
  onSave: (key: string) => void;
}) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const config = PROVIDER_CONFIGS[provider];

  return (
    <div className="space-y-1.5">
      <label className="block text-muted-foreground">Ajouter clé {config.label}</label>
      <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background">
        <input
          type={showKey ? "text" : "password"}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={config.keyPlaceholder}
          className="flex-1 bg-transparent px-2.5 py-2 text-xs text-foreground outline-none"
          autoComplete="off"
        />
        <button onClick={() => setShowKey((v) => !v)} className="px-2 text-muted-foreground">
          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      <button
        onClick={() => { const t = key.trim(); if (t) onSave(t); }}
        disabled={!key.trim()}
        className="flex w-full items-center justify-center gap-1 rounded bg-primary py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
      >
        <ChevronRight className="h-3 w-3" /> Sauvegarder
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------
function MessageBubble({
  m,
  projectFiles,
  activeFileId,
  onApply,
  getLabel,
}: {
  m: ChatMessage;
  projectFiles: ProjectFile[];
  activeFileId: string | null | undefined;
  onApply: (parsed: ParsedFile) => void;
  getLabel: (parsed: ParsedFile) => string;
}) {
  const isUser = m.role === "user";
  const parsedFiles: ParsedFile[] = m.role === "assistant" ? extractFiles(m.content) : [];
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
          {isUser ? (
            <pre className="whitespace-pre-wrap break-words font-sans text-xs">{m.content}</pre>
          ) : (
            <MarkdownContent content={m.content} />
          )}
          {parsedFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {parsedFiles.map((f, i) => {
                const label = getLabel(f);
                const isUpdate = label.startsWith("Mettre à jour");
                return (
                  <button
                    key={i}
                    onClick={() => onApply(f)}
                    className={`flex w-full items-center gap-1.5 rounded border px-2 py-1.5 text-left text-[11px] transition ${
                      isUpdate
                        ? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                        : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {isUpdate ? (
                      <RefreshCw className="h-3 w-3 shrink-0" />
                    ) : (
                      <FilePlus className="h-3 w-3 shrink-0" />
                    )}
                    <span className="truncate font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
