import { interpretClick } from "@yume/ai-client";
import type { ClickIntent, ProviderConfig, UIElement } from "@yume/types";
import { parseJsonLoose } from "./jsonParser";
import { VISION_SYSTEM_PROMPT, buildVisionUserPrompt } from "./prompts";

export async function interpret(
  config: ProviderConfig,
  annotatedImageBase64: string,
  uiElements: UIElement[],
): Promise<ClickIntent> {
  const userPrompt = `${VISION_SYSTEM_PROMPT}\n\n${buildVisionUserPrompt(uiElements)}`;
  const raw = await interpretClick(config, annotatedImageBase64, userPrompt);
  const parsed = parseJsonLoose<{
    targetId?: string | null;
    targetLabel?: string | null;
    reasoning?: string;
    freeformAction?: string;
  }>(raw);

  return {
    targetId: parsed.targetId ?? null,
    targetLabel: parsed.targetLabel ?? null,
    reasoning: parsed.reasoning ?? "",
    freeformAction: parsed.freeformAction || undefined,
  };
}
