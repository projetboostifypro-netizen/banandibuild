import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type ChatMessage } from "@/lib/ai-client";

export const DEFAULT_MODEL = "gpt-4o-mini";

type AIStore = {
  model: string;
  /** User-entered OpenAI API key — stored only on this device, never sent elsewhere */
  apiKey: string;
  history: Record<string, ChatMessage[]>;
  setModel: (model: string) => void;
  setApiKey: (key: string) => void;
  appendMessage: (projectId: string, msg: ChatMessage) => void;
  clearHistory: (projectId: string) => void;
  getResolvedApiKey: () => string;
};

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      model: DEFAULT_MODEL,
      apiKey: "",
      history: {},
      setModel: (model) => set({ model }),
      setApiKey: (apiKey) => set({ apiKey }),
      appendMessage: (projectId, msg) =>
        set((s) => ({
          history: {
            ...s.history,
            [projectId]: [...(s.history[projectId] ?? []), msg],
          },
        })),
      clearHistory: (projectId) =>
        set((s) => ({ history: { ...s.history, [projectId]: [] } })),
      // Returns the user-entered key (no build-time secret fallback — API keys
      // must never be bundled into client assets where they can be extracted).
      getResolvedApiKey: () => get().apiKey.trim(),
    }),
    { name: "trx-ai-store-v2" },
  ),
);
