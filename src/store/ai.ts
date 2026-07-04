import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type ChatMessage } from "@/lib/ai-client";

export const DEFAULT_MODEL = "gpt-4o-mini";
// Fallback from Vite build-time env (VITE_OPENAI_API_KEY)
const BUNDLED_KEY = (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env?.VITE_OPENAI_API_KEY ?? "";

type AIStore = {
  model: string;
  apiKey: string; // stored locally, entered by user
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
      getResolvedApiKey: () => {
        const stored = get().apiKey.trim();
        return stored || BUNDLED_KEY;
      },
    }),
    { name: "trx-ai-store-v2" },
  ),
);
