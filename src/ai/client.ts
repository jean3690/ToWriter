import { i18n } from "../i18n";
import type { ChatMessage, ClientType, ProviderConfig } from "./types";

export interface StreamChatOptions {
  clientType: ClientType;
  config: ProviderConfig;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  onToken: (delta: string) => void;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

async function handleSSE(
  res: Response,
  signal: AbortSignal | undefined,
  onData: (json: Record<string, unknown>) => void,
): Promise<void> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${i18n.global.t("store.requestFailed", { status: res.status })}: ${text.slice(0, 300)}`);
  }
  if (!res.body) throw new Error(i18n.global.t("store.noStreamBody"));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        if (!payload) continue;
        try {
          onData(JSON.parse(payload) as Record<string, unknown>);
        } catch {
          /* skip malformed chunks */
        }
      }
    }
  } catch (e) {
    if (signal?.aborted) return;
    throw e;
  }
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const { clientType, config, messages, temperature, maxTokens, signal, onToken } = opts;

  if (clientType === "anthropic") {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");
    const bodyMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    const payload: Record<string, unknown> = {
      model: config.model,
      messages: bodyMessages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    };
    if (system) payload.system = system;

    const res = await fetch(`${trimSlash(config.baseURL)}/messages`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    await handleSSE(res, signal, (json) => {
      if (json.type === "content_block_delta") {
        const delta = json.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          onToken(delta.text);
        }
      }
    });
    return;
  }

  const res = await fetch(`${trimSlash(config.baseURL)}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });
  await handleSSE(res, signal, (json) => {
    const choices = json.choices as Array<{ delta?: { content?: string } }> | undefined;
    const delta = choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) onToken(delta);
  });
}
