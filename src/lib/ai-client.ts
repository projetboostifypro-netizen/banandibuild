export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ParsedFile = { path: string; content: string; isSnippet: boolean };
export type AIProvider = "openai" | "groq" | "gemini" | "claude";

export interface ProviderConfig {
  id: AIProvider;
  label: string;
  baseUrl: string;
  keyPlaceholder: string;
  keyPrefix?: string;
  models: { value: string; label: string }[];
  defaultModel: string;
}

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    keyPlaceholder: "sk-...",
    keyPrefix: "sk-",
    models: [
      { value: "gpt-4o-mini", label: "GPT-4o mini (rapide)" },
      { value: "gpt-4o", label: "GPT-4o (puissant)" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (économique)" },
    ],
    defaultModel: "gpt-4o-mini",
  },
  groq: {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    keyPlaceholder: "gsk_...",
    keyPrefix: "gsk_",
    models: [
      { value: "llama-3.3-70b-versatile", label: "LLaMA 3.3 70B (polyvalent)" },
      { value: "llama-3.1-8b-instant", label: "LLaMA 3.1 8B (ultra rapide)" },
      { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B (contexte long)" },
      { value: "gemma2-9b-it", label: "Gemma2 9B" },
    ],
    defaultModel: "llama-3.3-70b-versatile",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyPlaceholder: "AIza...",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (rapide)" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (puissant)" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
    defaultModel: "gemini-2.0-flash",
  },
  claude: {
    id: "claude",
    label: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1/messages",
    keyPlaceholder: "sk-ant-...",
    keyPrefix: "sk-ant-",
    models: [
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (puissant)" },
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (rapide)" },
      { value: "claude-3-opus-20240229", label: "Claude 3 Opus (très puissant)" },
    ],
    defaultModel: "claude-3-5-sonnet-20241022",
  },
};

// ---------------------------------------------------------------------------
// OpenAI-compatible streaming (OpenAI, Groq, Gemini)
// ---------------------------------------------------------------------------
async function streamOpenAICompatible(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  signal: AbortSignal | undefined,
  baseUrl: string,
): Promise<string> {
  const res = await fetch(baseUrl, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || res.statusText;
    try {
      message = JSON.parse(text)?.error?.message || message;
    } catch {
      /* noop */
    }
    throw new Error(`${res.status}: ${message}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.replace(/^data:\s*/, "").trim();
      if (!trimmed || trimmed === "[DONE]") continue;
      try {
        const json = JSON.parse(trimmed);
        const delta = json.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        /* skip malformed chunk */
      }
    }
  }
  return full;
}

// ---------------------------------------------------------------------------
// Anthropic Claude streaming (different API format)
// ---------------------------------------------------------------------------
async function streamClaude(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  signal: AbortSignal | undefined,
): Promise<string> {
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");
  const systemText = systemMessages.map((m) => m.content).join("\n\n");

  const body: Record<string, unknown> = {
    model,
    messages: conversationMessages,
    stream: true,
    max_tokens: 4096,
  };
  if (systemText) {
    body.system = systemText;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || res.statusText;
    try {
      message = JSON.parse(text)?.error?.message || message;
    } catch {
      /* noop */
    }
    throw new Error(`Claude ${res.status}: ${message}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const trimmed = line.replace(/^data:\s*/, "").trim();
      if (!trimmed || trimmed === "[DONE]") continue;
      try {
        const json = JSON.parse(trimmed);
        if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
          const delta = json.delta.text ?? "";
          if (delta) {
            full += delta;
            onChunk(delta);
          }
        }
      } catch {
        /* skip malformed chunk */
      }
    }
  }
  return full;
}

// ---------------------------------------------------------------------------
// Main streaming entry point — routes to the right provider
// ---------------------------------------------------------------------------
export async function chatCompleteStream(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
  provider: AIProvider = "openai",
): Promise<string> {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Fournisseur inconnu: ${provider}`);

  if (provider === "claude") {
    return streamClaude(apiKey, model, messages, onChunk, signal);
  }

  return streamOpenAICompatible(apiKey, model, messages, onChunk, signal, config.baseUrl);
}

// ---------------------------------------------------------------------------
// Helpers for smart filename extraction
// ---------------------------------------------------------------------------

/** Look for a filename in the first comment line inside a code block.
 *  e.g. "// App.jsx", "/* App.css *\/", "# script.py"
 */
function filenameFromCodeComment(code: string): string | null {
  const firstLine = code.split("\n")[0].trim();
  const m = firstLine.match(/^(?:\/\/|\/\*|#)\s*([\w./\-]+\.[a-zA-Z0-9]{1,10})\b/);
  return m ? m[1] : null;
}

/** Look backwards in the prose text just before a code fence for a filename mention.
 *  e.g. "Voici `App.jsx` :", "modifie App.css :", "dans le fichier index.html"
 */
function filenameFromTextBefore(text: string): string | null {
  // Take last 200 chars before the fence (avoids false positives from far away)
  const nearby = text.slice(-200);
  // Backtick-quoted filenames get priority: `App.jsx`
  const backtick = nearby.match(/`([\w./\-]+\.[a-zA-Z0-9]{1,10})`[^`]*$/);
  if (backtick) return backtick[1];
  // Bare filenames followed by " :", colon, or end of line
  const bare = nearby.match(/([\w]+\.[a-zA-Z0-9]{1,10})(?:\s*[:\-]|\s*$)/m);
  if (bare) return bare[1];
  return null;
}

// ---------------------------------------------------------------------------
// Parse fenced code blocks from AI responses with smart filename detection
// ---------------------------------------------------------------------------
export function extractFiles(markdown: string): ParsedFile[] {
  const out: ParsedFile[] = [];
  // Match ```lang [filename]\n...``` blocks
  const blockRe = /```([\w+-]*)(?:\s+([\w./\-]+\.[a-zA-Z0-9]{1,10}))?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let snippetIdx = 0;

  while ((m = blockRe.exec(markdown)) !== null) {
    const lang = m[1] || "";
    const inlineFilename = m[2] ?? null; // optional filename on the fence line: ```jsx App.jsx
    const codeContent = m[3] ?? "";     // everything between the fences

    // --- Priority order for filename ---
    // 1. Filename on the fence line: ```jsx App.jsx
    let filename = inlineFilename ?? null;

    // 2. Look at text before this code block
    if (!filename) {
      const textBefore = markdown.slice(0, m.index);
      filename = filenameFromTextBefore(textBefore);
    }

    // 3. Look for a comment on the first line of the code
    if (!filename) {
      filename = filenameFromCodeComment(codeContent);
    }

    const isSnippet = !filename;
    const finalPath = filename ?? `snippet-${++snippetIdx}.${extForLang(lang)}`;

    out.push({ path: finalPath, content: codeContent, isSnippet });
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
