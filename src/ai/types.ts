export type ClientType = "openai" | "anthropic";

export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ProviderPreset {
  id: string;
  name: string;
  clientType: ClientType;
  baseURL: string;
  model: string;
}

export interface ActiveConfig extends ProviderConfig {
  clientType: ClientType;
  name: string;
}

export interface AiSettings {
  activeId: string;
  configs: Record<string, ProviderConfig>;
  temperature: number;
  maxTokens: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
