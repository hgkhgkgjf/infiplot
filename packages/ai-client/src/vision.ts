import type { ProviderConfig } from "@yume/types";
import { fetchWithRetry } from "./fetchWithRetry";

export async function interpretClick(
  config: ProviderConfig,
  imageBase64: string,
  prompt: string,
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;

  const body = {
    model: config.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
        ],
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), 60_000);

  let res: Response;
  try {
    res = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: timeoutCtrl.signal,
      retries: 0,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vision API error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return json.choices[0]?.message.content ?? "";
}
