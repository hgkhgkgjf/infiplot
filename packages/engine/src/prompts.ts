import type { Session, StoryFrame, UIElement } from "@yume/types";

export const DIRECTOR_SYSTEM = `你是一个交互视觉小说的编剧导演。每次根据世界观、画风和历史，输出当前画面要呈现的内容。

必须输出严格 JSON，结构如下：
{
  "narration": "本帧旁白（可空字符串）",
  "speaker": "本帧说话角色名（可空）",
  "line": "本帧角色台词（可空）",
  "scenePrompt": "英文场景描述，给图像模型用，描述画面里看到什么",
  "uiElements": [
    { "id": "choice_1", "kind": "choice", "label": "选项一文字（≤15 字）" },
    { "id": "choice_2", "kind": "choice", "label": "选项二文字（≤15 字）" },
    { "id": "choice_3", "kind": "choice", "label": "选项三文字（≤15 字）" }
  ]
}

规则：
- narration / line 中文，scenePrompt 英文
- 默认 3 个 choice 元素，可以根据情境额外加 menu/item/custom（罕见）
- 选项必须能切实推进剧情，且互不重复
- scenePrompt 描述当前的画面，不要包括 UI 元素，UI 元素会另外渲染
- 单帧旁白与台词加起来控制在 80 字以内
- 不要输出 JSON 以外的任何文本`;

export function buildDirectorUserMessage(session: Session): string {
  const parts: string[] = [];
  parts.push(`世界观：${session.worldSetting}`);
  parts.push(`画风：${session.styleGuide}`);

  if (session.history.length === 0) {
    parts.push("\n这是故事的开场。请生成开场画面，严格以 JSON 格式返回。");
    return parts.join("\n");
  }

  parts.push("\n历史：");
  session.history.forEach((entry, idx) => {
    const f = entry.frame;
    const beat: string[] = [`【第 ${idx + 1} 帧】`];
    if (f.narration) beat.push(`旁白：${f.narration}`);
    if (f.line) beat.push(`${f.speaker ?? "?"}：${f.line}`);
    if (entry.intent) {
      beat.push(
        `用户行为：${entry.intent.targetLabel ?? entry.intent.freeformAction ?? "未知"}`,
      );
    }
    parts.push(beat.join("\n"));
  });

  parts.push("\n请生成下一帧，严格以 JSON 格式返回。");
  return parts.join("\n");
}

export function buildImagePrompt(
  frame: StoryFrame,
  styleGuide: string,
): string {
  const choiceList = frame.uiElements
    .filter((e) => e.kind === "choice")
    .map((e, i) => `${i + 1}. ${e.label}`)
    .join("\n");

  const extraUI = frame.uiElements
    .filter((e) => e.kind !== "choice")
    .map((e) => `- ${e.kind}: ${e.label}`)
    .join("\n");

  return `Generate a vertical 9:16 visual novel UI screen.

ART STYLE: ${styleGuide}
(Match this style consistently — for the scene art AND the UI elements.
For example: anime → traditional galgame dialogue box; cyberpunk → neon HUD;
stick figure → hand-drawn paper UI; cinematic realism → minimalist film overlay.)

SCENE (occupies the upper portion of the image):
${frame.scenePrompt}

DIALOGUE PANEL (semi-transparent, lower-middle area):
${frame.speaker ? `Speaker name displayed prominently: "${frame.speaker}"` : "Narration only — no speaker tag."}
${frame.line ? `Dialogue text: "${frame.line}"` : ""}
${frame.narration ? `Narration text (italic if speaker also present): "${frame.narration}"` : ""}

CHOICE PANEL (bottom area, three clearly tappable buttons stacked or arranged):
${choiceList}
${extraUI ? `\nADDITIONAL UI ELEMENTS:\n${extraUI}` : ""}

CRITICAL LAYOUT REQUIREMENTS:
- All text must be perfectly legible (high contrast, readable size)
- Choice buttons must be clearly distinguishable as interactive elements
- Choice text must NOT be cropped, NOT overlap with character faces
- The image is the entire interface — no external chrome will be added
- Choices appear in the order listed above`;
}

export const VISION_SYSTEM_PROMPT = `你是视觉理解助手。用户在视觉小说界面上点击了红色圆点位置，你要根据红点位置和图中可见的 UI 元素，判断用户的意图。

必须输出严格 JSON：
{
  "targetId": "对应的 UI 元素 id（choice_1 / choice_2 / choice_3 / menu / ...），如果点击的是非 UI 区域则为 null",
  "targetLabel": "对应 UI 元素的文字描述（如 '告诉她真相'），未知则为 null",
  "reasoning": "一句话说明判断理由",
  "freeformAction": "如果用户点的是场景中的物件/角色等非选项区域，描述他可能的意图（如 '想拿起桌上的钥匙'），否则空字符串"
}

不要输出 JSON 以外的任何文本。`;

export function buildVisionUserPrompt(uiElements: UIElement[]): string {
  const list = uiElements
    .map((e) => `- id="${e.id}" kind="${e.kind}" label="${e.label}"`)
    .join("\n");
  return `当前画面包含以下已知 UI 元素：
${list}

红点位置即为用户点击位置。请判断用户的意图，并以 JSON 格式返回结果。`;
}
