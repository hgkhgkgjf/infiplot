import type {
  ClickIntent,
  EngineConfig,
  InteractRequest,
  InteractResponse,
  Session,
  StartRequest,
  StartResponse,
  VisionRequest,
  VisionResponse,
} from "@yume/types";
import { annotateClick } from "./annotate";
import { direct } from "./director";
import { render } from "./renderer";
import { interpret } from "./vision";

function newSessionId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function startSession(
  config: EngineConfig,
  req: StartRequest,
): Promise<StartResponse> {
  const session: Session = {
    id: newSessionId(),
    createdAt: Date.now(),
    worldSetting: req.worldSetting.trim(),
    styleGuide: req.styleGuide.trim(),
    history: [],
  };

  const frame = await direct(config.text, session);
  const imageBase64 = await render(config.image, frame, session.styleGuide);

  return {
    sessionId: session.id,
    frame,
    imageBase64,
  };
}

export async function visionTurn(
  config: EngineConfig,
  req: VisionRequest,
): Promise<VisionResponse> {
  const annotated = await annotateClick(req.prevImageBase64, req.click);
  const lastFrame = req.session.history.at(-1)?.frame;
  const uiElements = lastFrame?.uiElements ?? [];
  const intent = await interpret(config.vision, annotated, uiElements);
  return { intent };
}

export async function takeTurn(
  config: EngineConfig,
  req: InteractRequest,
): Promise<InteractResponse> {
  const updatedSession: Session = {
    ...req.session,
    history: req.session.history.map((entry, idx, arr) =>
      idx === arr.length - 1
        ? { ...entry, click: req.click, intent: req.intent }
        : entry,
    ),
  };

  const nextFrame = await direct(config.text, updatedSession);
  const nextImage = await render(
    config.image,
    nextFrame,
    updatedSession.styleGuide,
  );

  return {
    session: updatedSession,
    frame: nextFrame,
    imageBase64: nextImage,
    intent: req.intent,
  };
}
