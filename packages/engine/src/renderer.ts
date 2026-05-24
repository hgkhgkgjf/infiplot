import { generateImage } from "@yume/ai-client";
import type { ProviderConfig, StoryFrame } from "@yume/types";
import { buildImagePrompt } from "./prompts";

export async function render(
  config: ProviderConfig,
  frame: StoryFrame,
  styleGuide: string,
): Promise<string> {
  const prompt = buildImagePrompt(frame, styleGuide);
  return generateImage(config, prompt);
}
