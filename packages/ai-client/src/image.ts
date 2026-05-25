import type { ProviderConfig } from "@yume/types";
import { fetchWithRetry } from "./fetchWithRetry";

type ImageUrlPart = { type: string; image_url?: { url?: string } };
type ChatResponse = {
  choices: {
    message: {
      content: string | ImageUrlPart[];
      images?: ImageUrlPart[];
    };
  }[];
};

export async function generateImage(
  config: ProviderConfig,
  prompt: string,
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;

  const body = {
    model: config.model,
    modalities: ["image", "text"],
    size: "1792x1024",
    messages: [{ role: "user", content: prompt }],
  };

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
    throw new Error(`Image API error ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as ChatResponse;
  const msg = json.choices[0]?.message;
  if (!msg) throw new Error("Image API returned no message");

  // 1) OpenRouter-style: msg.images = [{ image_url: { url } }]
  // 2) OpenAI multimodal: msg.content = [{ type: "image_url", image_url: { url } }]
  const structured: ImageUrlPart[] = [];
  if (msg.images) structured.push(...msg.images);
  if (Array.isArray(msg.content)) structured.push(...msg.content);
  for (const part of structured) {
    const u = part.image_url?.url;
    if (u) return await urlToBase64(u);
  }

  // 3) provider-style: content is a string with markdown image ![alt](url)
  //    or a bare URL fragment
  if (typeof msg.content === "string") {
    const md = msg.content.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
    if (md?.[1]) return await urlToBase64(md[1]);
    const bare = msg.content.match(/https?:\/\/\S+?\.(?:png|jpg|jpeg|webp)/i);
    if (bare?.[0]) return await urlToBase64(bare[0]);
  }

  throw new Error(
    `No image found in response: ${JSON.stringify(msg).slice(0, 300)}`,
  );
}

async function urlToBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) {
    const idx = url.indexOf("base64,");
    if (idx === -1) throw new Error("data URL is not base64-encoded");
    return url.slice(idx + "base64,".length);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image url: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}
