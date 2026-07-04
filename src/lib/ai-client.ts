export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AIConfig = {
  apiKey?: string;
  model?: string;
  baseURL?: string;
};

export const DEFAULT_BASE_URL = "/api/public/ai-chat";
export const NATIVE_AI_URL =
  "https://project--edfa4d80-9acf-4e83-a485-d88a5af56549-dev.lovable.app/api/public/ai-chat";
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type CapacitorAPI = {
  isNativePlatform?: () => boolean;
};

function isNativeApp() {
  const w = globalThis as unknown as { Capacitor?: CapacitorAPI };
  return w.Capacitor?.isNativePlatform?.() ?? false;
}

function resolveAIEndpoint(cfg: AIConfig) {
  const configured = cfg.baseURL?.trim();
  if (configured && !configured.includes("ai.gateway.lovable.dev")) return configured;
  return isNativeApp() ? NATIVE_AI_URL : DEFAULT_BASE_URL;
}

export async function chatComplete(
  cfg: AIConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const url = resolveAIEndpoint(cfg);
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || res.statusText;
    try {
      message = JSON.parse(text)?.error || message;
    } catch {
      // Keep the raw response text.
    }
    throw new Error(`AI ${res.status}: ${message}`);
  }
  const j = await res.json();
  return j?.text ?? "";
}

export type ParsedFile = { path: string; content: string };

// Extract fenced code blocks with optional filename hints:
// ```lang path/to/file.ext
// ...code...
// ```
// or a line above the block like "**file.ts**" / "// file.ts"
export function extractFiles(markdown: string): ParsedFile[] {
  const out: ParsedFile[] = [];
  const re = /(?:^|\n)(?:[^\n]*?[`*]{0,3}\s*([\w./\-]+\.[a-zA-Z0-9]+)[`*]{0,3}[^\n]*\n)?```([\w+-]*)?(?:\s+([\w./\-]+\.[a-zA-Z0-9]+))?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(markdown)) !== null) {
    const hinted = m[3] || m[1];
    const lang = m[2] || "";
    const content = m[4] ?? "";
    const path = hinted || `snippet-${++idx}.${extForLang(lang)}`;
    out.push({ path, content });
  }
  return out;
}

function extForLang(lang: string): string {
  const l = lang.toLowerCase();
  if (l === "ts" || l === "typescript") return "ts";
  if (l === "tsx") return "tsx";
  if (l === "js" || l === "javascript") return "js";
  if (l === "jsx") return "jsx";
  if (l === "html") return "html";
  if (l === "css") return "css";
  if (l === "json") return "json";
  if (l === "md" || l === "markdown") return "md";
  if (l === "py" || l === "python") return "py";
  return "txt";
}