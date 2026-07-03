import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_BASE_URL, DEFAULT_MODEL, type ChatMessage } from "@/lib/ai-client";

type AIStore = {
  apiKey: string;
  model: string;
  baseURL: string;
  history: Record<string, ChatMessage[]>; // per project
  setConfig: (cfg: Partial<Pick<AIStore, "apiKey" | "model" | "baseURL">>) => void;
  appendMessage: (projectId: string, msg: ChatMessage) => void;
  clearHistory: (projectId: string) => void;
};

export const useAIStore = create<AIStore>()(
  persist(
    (set) => ({
      apiKey: "",
      model: DEFAULT_MODEL,
      baseURL: DEFAULT_BASE_URL,
      history: {},
      setConfig: (cfg) => set((s) => ({ ...s, ...cfg })),
      appendMessage: (projectId, msg) =>
        set((s) => ({
          history: {
            ...s.history,
            [projectId]: [...(s.history[projectId] ?? []), msg],
          },
        })),
      clearHistory: (projectId) =>
        set((s) => ({ history: { ...s.history, [projectId]: [] } })),
    }),
    { name: "trx-ai-store" },
  ),
);