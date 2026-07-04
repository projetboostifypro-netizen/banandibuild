import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type ChatMessage, type AIProvider, PROVIDER_CONFIGS } from "@/lib/ai-client";

export type { AIProvider };

type AIStore = {
  provider: AIProvider;
  model: string;
  /** API keys per provider — stored only on this device, never sent elsewhere */
  apiKeys: Partial<Record<AIProvider, string>>;
  history: Record<string, ChatMessage[]>;
  setProvider: (provider: AIProvider) => void;
  setModel: (model: string) => void;
  setApiKey: (provider: AIProvider, key: string) => void;
  removeApiKey: (provider: AIProvider) => void;
  appendMessage: (projectId: string, msg: ChatMessage) => void;
  clearHistory: (projectId: string) => void;
  getActiveApiKey: () => string;
  getActiveModel: () => string;
};

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      provider: "openai",
      model: "gpt-4o-mini",
      apiKeys: {},
      history: {},

      setProvider: (provider) => {
        const config = PROVIDER_CONFIGS[provider];
        set({ provider, model: config.defaultModel });
      },

      setModel: (model) => set({ model }),

      setApiKey: (provider, key) =>
        set((s) => ({
          apiKeys: { ...s.apiKeys, [provider]: key.trim() },
        })),

      removeApiKey: (provider) =>
        set((s) => {
          const next = { ...s.apiKeys };
          delete next[provider];
          return { apiKeys: next };
        }),

      appendMessage: (projectId, msg) =>
        set((s) => ({
          history: {
            ...s.history,
            [projectId]: [...(s.history[projectId] ?? []), msg],
          },
        })),

      clearHistory: (projectId) =>
        set((s) => ({ history: { ...s.history, [projectId]: [] } })),

      getActiveApiKey: () => {
        const { provider, apiKeys } = get();
        return (apiKeys[provider] ?? "").trim();
      },

      getActiveModel: () => {
        const { model } = get();
        return model;
      },
    }),
    { name: "trx-ai-store-v3" },
  ),
);
