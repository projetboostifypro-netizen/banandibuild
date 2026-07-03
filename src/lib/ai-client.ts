export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AIConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
};

export const DEFAULT_BASE_URL = "https://ai.gateway.lovable.dev/v1";
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export async function chatComplete(
  cfg: AIConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const url = `${cfg.baseURL || DEFAULT_BASE_URL}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      "Lovable-API-Key": cfg.apiKey,
    },
    body: JSON.stringify({
      model: cfg.model || DEFAULT_MODEL,
      messages,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI ${res.status}: ${t || res.statusText}`);
  }
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
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