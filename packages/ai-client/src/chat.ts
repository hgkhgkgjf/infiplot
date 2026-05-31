import type { ProviderConfig } from "@yume/types";
import { fetchWithRetry } from "./fetchWithRetry";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chat(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: { temperature?: number; responseFormat?: "json_object" | "text" },
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: opts?.temperature ?? 0.9,
  };
  if (opts?.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat API error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };

  // 修复问题2和问题5：检查choices是否为空，以及message是否存在
  const content = json.choices?.[0]?.message?.content;
  if (content === undefined || content === null) {
    throw new Error(
      `Chat API returned no content. Response: ${JSON.stringify(json).slice(0, 500)}`
    );
  }

  return content;
}
