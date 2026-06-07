import { generateText } from "ai";
import type { ModelMessage } from "ai";
import type { ProviderConfig } from "@infiplot/types";
import { createLanguageModel, resolveProtocol } from "./model";

const VISION_TIMEOUT_MS = 60_000;

export async function interpretClick(
  config: ProviderConfig,
  imageBase64: string,
  prompt: string,
): Promise<string> {
  return analyzeImageDataUrl(
    config,
    `data:image/png;base64,${imageBase64}`,
    prompt,
  );
}

export async function analyzeImageDataUrl(
  config: ProviderConfig,
  imageDataUrl: string,
  prompt: string,
): Promise<string> {
  const protocol = resolveProtocol(config);
  const model = createLanguageModel(config, protocol);

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image", image: imageDataUrl },
      ],
    },
  ];

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), VISION_TIMEOUT_MS);
  try {
    const { text } = await generateText({
      model,
      messages,
      temperature: 0.2,
      maxRetries: 0,
      abortSignal: timeoutCtrl.signal,
    });
    if (typeof text !== "string" || text.length === 0) {
      throw new Error(`Vision API (AI SDK ${protocol}) returned no content.`);
    }
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}
