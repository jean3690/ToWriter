import { defineStore } from "pinia";
import { i18n } from "../i18n";
import { streamChat } from "../ai/client";
import type { ActiveConfig, AiSettings, ClientType, ProviderConfig } from "../ai/types";
import { persistLoad, persistSave } from "../services/persist";

export const PROVIDER_PRESETS: Record<
  string,
  { id: string; name: string; clientType: ClientType; baseURL: string; model: string }
> = {
  ollama: {
    id: "ollama",
    name: "Ollama",
    clientType: "openai",
    baseURL: "http://localhost:11434/v1",
    model: "qwen2.5:14b",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    clientType: "openai",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    clientType: "openai",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    clientType: "anthropic",
    baseURL: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-20250514",
  },
};

const STORE_KEY = "towriter:ai";

interface AiState {
  activeId: string;
  configs: Record<string, ProviderConfig>;
  temperature: number;
  maxTokens: number;
  loaded: boolean;
  error: string | null;
  testing: boolean;
}

export const useAiStore = defineStore("ai", {
  state: (): AiState => ({
    activeId: "ollama",
    configs: {},
    temperature: 0.8,
    maxTokens: 2048,
    loaded: false,
    error: null,
    testing: false,
  }),
  getters: {
    activeConfig(state): ActiveConfig {
      const preset = PROVIDER_PRESETS[state.activeId];
      const cfg = state.configs[state.activeId] ?? { baseURL: "", apiKey: "", model: "" };
      return {
        clientType: preset.clientType,
        name: preset.name,
        baseURL: cfg.baseURL || preset.baseURL,
        apiKey: cfg.apiKey || "",
        model: cfg.model || preset.model,
      };
    },
    configured(state): boolean {
      return Boolean(state.configs[state.activeId]?.baseURL || state.configs[state.activeId]?.apiKey);
    },
  },
  actions: {
    async load() {
      const data = await persistLoad<AiSettings>(STORE_KEY);
      if (data) {
        this.activeId = data.activeId || this.activeId;
        this.configs = data.configs ?? {};
        this.temperature = data.temperature ?? 0.8;
        this.maxTokens = data.maxTokens ?? 2048;
      }
      this.loaded = true;
    },
    async persist() {
      const data: AiSettings = {
        activeId: this.activeId,
        configs: this.configs,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      };
      await persistSave(STORE_KEY, data);
    },
    setActive(id: string) {
      this.activeId = id;
      void this.persist();
    },
    async updateProvider(id: string, patch: Partial<ProviderConfig>) {
      this.configs[id] = {
        ...(this.configs[id] ?? { baseURL: "", apiKey: "", model: "" }),
        ...patch,
      };
      await this.persist();
    },
    async updateTemperature(t: number) {
      this.temperature = t;
      await this.persist();
    },
    async updateMaxTokens(t: number) {
      this.maxTokens = t;
      await this.persist();
    },
    async testConnection(config?: Partial<ProviderConfig>): Promise<string> {
      this.testing = true;
      this.error = null;
      try {
        const base = this.activeConfig;
        const cfg: ActiveConfig = {
          ...base,
          baseURL: config?.baseURL ?? base.baseURL,
          apiKey: config?.apiKey ?? base.apiKey,
          model: config?.model ?? base.model,
        };
        let got = "";
        await streamChat({
          clientType: cfg.clientType,
          config: cfg,
          messages: [{ role: "user", content: "Reply with only: OK" }],
          temperature: 0,
          maxTokens: 16,
          onToken: (d) => {
            got += d;
          },
        });
        return got.trim() || i18n.global.t("store.connectionOk");
      } finally {
        this.testing = false;
      }
    },
  },
});
