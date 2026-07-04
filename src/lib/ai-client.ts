export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ParsedFile = { path: string; content: string };

// ---------------------------------------------------------------------------
// Direct OpenAI API call with streaming
// ---------------------------------------------------------------------------
export async function chatCompleteStream(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
    try { message = JSON.parse(text)?.error?.message || message; } catch { /* noop */ }
    throw new Error(`OpenAI ${res.status}: ${message}`);
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
      } catch { /* skip malformed chunk */ }
    }
  }
  return full;
}

// ---------------------------------------------------------------------------
// Parse fenced code blocks with filename hints from AI responses
// \`\`\`lang path/to/file.ext
// ...code...
// \`\`\`
// ---------------------------------------------------------------------------
export function extractFiles(markdown: string): ParsedFile[] {
  const out: ParsedFile[] = [];
  const re =
    /(?:^|\n)(?:[^\n]*?[`*]{0,3}\s*([\w./\-]+\.[a-zA-Z0-9]+)[`*]{0,3}[^\n]*\n)?```([\w+-]*)(?:\s+([\w./\-]+\.[a-zA-Z0-9]+))?\n([\s\S]*?)```/g;
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
