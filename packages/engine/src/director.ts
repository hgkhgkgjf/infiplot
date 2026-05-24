import { chat } from "@yume/ai-client";
import type { ProviderConfig, Session, StoryFrame, UIElement } from "@yume/types";
import { parseJsonLoose } from "./jsonParser";
import { DIRECTOR_SYSTEM, buildDirectorUserMessage } from "./prompts";

type DirectorOutput = {
  narration?: string;
  speaker?: string;
  line?: string;
  scenePrompt: string;
  uiElements: UIElement[];
};

export async function direct(
  config: ProviderConfig,
  session: Session,
): Promise<StoryFrame> {
  const raw = await chat(
    config,
    [
      { role: "system", content: DIRECTOR_SYSTEM },
      { role: "user", content: buildDirectorUserMessage(session) },
    ],
    { temperature: 0.9, responseFormat: "json_object" },
  );

  const parsed = parseJsonLoose<DirectorOutput>(raw);

  return {
    id: `frame_${Date.now()}`,
    narration: parsed.narration?.trim() || undefined,
    speaker: parsed.speaker?.trim() || undefined,
    line: parsed.line?.trim() || undefined,
    scenePrompt: parsed.scenePrompt,
    uiElements: parsed.uiElements ?? [],
  };
}
