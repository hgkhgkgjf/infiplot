import { generateText } from "ai";
import type { LanguageModelUsage, ModelMessage } from "ai";
import type { ProviderConfig } from "@infiplot/types";
import { createLanguageModel, resolveProtocol } from "./model";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// AI SDK 6 unifies cache stats across providers into usage.inputTokenDetails,
// so a single shape covers Anthropic, Gemini, and OpenAI-compatible providers.
function summarizeSdkUsage(
  tag: string,
  usage: LanguageModelUsage | undefined,
): string {
  if (!usage) return `[cache] ${tag} no-usage`;
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const read = usage.inputTokenDetails?.cacheReadTokens;
  const write = usage.inputTokenDetails?.cacheWriteTokens;
  if (typeof read === "number" || typeof write === "number") {
    const hit = read ?? 0;
    const create = write ?? 0;
    const rate = input > 0 ? ((hit / input) * 100).toFixed(1) : "n/a";
    return `[cache] ${tag} hit=${hit} create=${create} input=${input} rate=${rate}% completion=${output}`;
  }
  return `[cache] ${tag} input=${input} completion=${output} (provider didn't report cache stats)`;
}

export async function chat(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: {
    temperature?: number;
    tag?: string;
  },
): Promise<string> {
  const protocol = resolveProtocol(config);
  const model = createLanguageModel(config, protocol);

  const system = messages.find((m) => m.role === "system")?.content;
  const convo: ModelMessage[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const { text, usage } = await generateText({
    model,
    system,
    messages: convo,
    temperature: opts?.temperature ?? 0.9,
  });

  console.log(summarizeSdkUsage(opts?.tag ?? "chat", usage));

  if (typeof text !== "string" || text.length === 0) {
    throw new Error(`Chat API (AI SDK ${protocol}) returned no content.`);
  }
  return text;
}
