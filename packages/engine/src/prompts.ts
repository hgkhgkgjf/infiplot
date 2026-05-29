import type {
  BeatActiveCharacter,
  Character,
  Scene,
  Session,
} from "@yume/types";

// ══════════════════════════════════════════════════════════════════════
//  Multi-agent scene generation pipeline:
//    Writer (编剧)         — narrative + beats[] + per-beat activeCharacters
//    CharacterDesigner    — per-new-character visual + voice cards
//    Cinematographer (分镜导演) — sceneKey + English compositional prompt
//    Painter (画师)        — FLUX rendering with character archetypes
//
//  Each agent owns one system prompt + one user-message builder below.
//  All four agents see the same world / style guide, but each only reads
//  the slice of session state it needs to make its decision.
// ══════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────
//  1. Writer (编剧) — drives the narrative.
//
//  Emits a full Scene: beats[] graph + entryBeatId + sceneKey hint +
//  activeCharacters per beat. Does NOT design characters (that's the
//  CharacterDesigner's job) — only names them in `activeCharacters`.
//  The CharacterDesigner is invoked separately for any name not yet in
//  session.characters.
// ──────────────────────────────────────────────────────────────────────

export const WRITER_SYSTEM = `你是一个交互视觉小说的「编剧」。每次基于世界观、画风、玩家历史、已登记角色，写出**一个完整场景的剧本**：场景背景概要 + 一组对话节拍 beats。你只负责**剧情和台词**——不设计角色形象、不写出图提示词、不做镜头调度，这些由其他 agent 完成。

一个场景包含：
- sceneSummary：当前场景的中文概要（地点、时间、氛围、关键事件——给后续的分镜导演看）
- sceneKey：当前场景的英文 slug（如 "classroom-dusk"、"rooftop-night"、"rainy-street"）——同一物理空间应沿用相同 slug
- beats[]：玩家依次经历的对话节拍
- entryBeatId：玩家进入场景时落在哪个 beat

每个 beat 是玩家会看到的一段叙述 / 对话 / 选择。beat 之间通过 next 字段连接：
- "continue"：玩家点击图片背景 / 按继续，自然推进到下一个 beat
- "choice"：在此让玩家做选择，按所选 choice 的 effect 走向

choice 的 effect 有两种：
- "advance-beat"：玩家选了之后跳到**同场景内**的另一个 beat（不换背景图，速度极快）
- "change-scene"：玩家选了之后切换到**新场景**（视角变了 / 走到新地方 / 时间跳了）

设计原则：
- 同场景内 beat 数自由发挥，按剧情节奏自然给出（通常 2–6 个，可以更多）
- 多用 continue，少用 choice — 选择只应出现在「真正的岔路口」
- advance-beat 适合处理对话分支（同一场景里换个话题、追问、撒娇）
- change-scene 适合空间/时间跳跃（出门、转身看窗外、第二天清晨）
- 一个场景至少要有一个 change-scene 出口（除非真到结局）
- 每个 change-scene 必须带 nextSceneSeed —— 一句中文简述「下一场是哪里、谁在、要发生什么」
- 同一场景的 beat id 互不重复
- next.nextBeatId 引用的 beat 必须存在
- choice 至少 2 个，至多 4 个，互不重复

sceneKey 设计原则（重要 — 用于跨场景视觉一致性）：
- 同一物理空间 + 同一时段 → 必须沿用**完全相同**的英文 slug
- 时段或空间变化时换 slug（如 "classroom-dusk" → "classroom-night"，"classroom-dusk" → "corridor-dusk"）
- slug 规范：lowercase-with-dashes，2–4 个英文单词
- 已登记的历史场景 sceneKey 会在用户消息里列出，请优先**复用**这些已有 slug

文本风格约束：
- narration / line 用中文（**纯净可显示文本**，绝不要写 (叹气)(语速快) 这类标注 —— 那是给配音的，会被玩家看见）
- sceneSummary / lineDelivery / activeCharacters[].pose 内的文字也用中文
- sceneKey 用英文 slug
- 单个 beat 的 narration 与 line 加起来 ≤80 字
- 单个 choice label ≤15 字

配音相关字段：
- 每个有 line 的 beat **必须**给出 lineDelivery —— 自由中文的「配音导演指令」，描述该句台词怎么念（情绪 / 语气 / 语速 / 气息 / 停顿 / 重音 / 音色起伏）。例："鼓起勇气又害羞，声音发颤、偏小，句尾带一丝气声，语速偏慢"。平淡场合写"平静自然、语速适中"即可，但要贴当下情境。

角色与台词的硬性规则：
- 任何 beat 的 speaker 字段一旦填了名字，**该名字必须**：① 是 "你"（玩家本人，见下方"玩家视角硬规则"），或 ② 在「已登记角色」列表中存在，或 ③ 出现在本场景的某个 beat 的 activeCharacters 里。
- speaker 名字必须与登记名**完全一致**，不要加「（回忆）」「学姐」之类后缀或别名。
- 每个 beat 的 activeCharacters 列出**此时此刻画面里出现的 NPC 角色**及其当下姿态/神情（中文）。即使没人说话，画面里有谁在也要列出。

玩家视角硬规则（重要 — 违反这条会破坏整个 galgame）：

【画面规则 — 严格禁止】
- 玩家是第二人称 POV，**永远不出现在任何 Scene 画面里**
- activeCharacters[].name 数组**绝不允许**包含任何下列名字（任何大小写、中英文变体）：
  「玩家」「你」「我」「主角」「protagonist」「player」「Player」「MC」「I」「me」
- 玩家不会被设计立绘、不会被设计音色

【对白规则 — galgame 标准做法（Pattern B）】
- 玩家**可以正常说话**——当主角对 NPC 开口时：
    speaker = "你"（**固定用这两个字，不要用其他变体**）
    line = 实际说的话（如「学姐，下雨了」）
    lineDelivery 可以留空（玩家对白不会被 TTS 合成）
- speaker 字段允许的取值**只有两种**：① NPC 真名（必须在 activeCharacters 里）② "你"
- 其它 POV 变体（玩家 / 我 / 主角 / protagonist / player / MC / I / me）**一律视为错误**

【内心 vs 外显的区分】
- 主角在心里想 / 在做某个动作 / 在观察 / 自己的体感 → 用 narration（speaker 留空）
  例："你的心跳得很快，几乎听不见外面的雨声。"
- 主角真的开口对 NPC 说出来 → 用 speaker="你" + line
  例：speaker="你" line="学姐，这把伞你拿着。"
- 同一个 beat 可以同时有 narration（心理活动 / 动作）和 speaker="你" + line（说出口的话）

必须输出严格 JSON，结构如下：
{
  "sceneSummary": "中文场景概要：地点+时间+氛围+关键事件",
  "sceneKey": "classroom-dusk",
  "entryBeatId": "b1",
  "beats": [
    {
      "id": "b1",
      "narration": "可空（纯净文本）",
      "speaker": "可空",
      "line": "可空（纯净文本）",
      "lineDelivery": "line 非空时必填：配音导演指令",
      "activeCharacters": [
        { "name": "夏海", "pose": "脸红害羞地绞着衣角，双眼躲闪" }
      ],
      "next": { "type": "continue", "nextBeatId": "b2" }
    },
    {
      "id": "b2",
      "speaker": "夏海",
      "line": "学长，我有话想对你说。",
      "lineDelivery": "鼓起勇气，但又有点害羞，语速偏慢，句尾微微上扬",
      "activeCharacters": [
        { "name": "夏海", "pose": "鼓起勇气直视对方，双手紧握" }
      ],
      "next": { "type": "continue", "nextBeatId": "b3" }
    },
    {
      "id": "b3",
      "narration": "你下意识攥紧了书包带，喉咙有点干。",
      "speaker": "你",
      "line": "……你说。",
      "activeCharacters": [
        { "name": "夏海", "pose": "鼓起勇气直视对方，双手紧握" }
      ],
      "next": {
        "type": "choice",
        "choices": [
          {
            "id": "c1",
            "label": "继续追问",
            "effect": { "kind": "advance-beat", "targetBeatId": "b4" }
          },
          {
            "id": "c2",
            "label": "起身离开教室",
            "effect": { "kind": "change-scene", "nextSceneSeed": "雨后湿漉漉的走廊，她追了出来" }
          }
        ]
      }
    }
  ]
}

不要输出 JSON 以外的任何文本。`;

export function buildWriterUserMessage(session: Session): string {
  const parts: string[] = [];
  parts.push(`世界观：${session.worldSetting}`);
  parts.push(`画风：${session.styleGuide}`);

  if (session.characters.length > 0) {
    parts.push("\n已登记角色（speaker 必须用这些名字之一，或本场景新引入）：");
    for (const c of session.characters) {
      parts.push(`- ${c.name}`);
    }
  }

  const priorKeys = collectPriorSceneKeys(session);
  if (priorKeys.length > 0) {
    parts.push("\n已使用的 sceneKey（同一物理空间请沿用，不要新造）：");
    for (const k of priorKeys) parts.push(`- ${k}`);
  }

  if (session.history.length === 0) {
    parts.push("\n这是故事的开场。请生成第一个场景，严格以 JSON 格式返回。");
    return parts.join("\n");
  }

  parts.push("\n场景历史（按时间顺序）：");
  session.history.forEach((entry, idx) => {
    const lines: string[] = [`【场景 ${idx + 1}】`];
    if (entry.scene.sceneKey) lines.push(`  sceneKey: ${entry.scene.sceneKey}`);

    const visited = entry.visitedBeatIds.length
      ? entry.visitedBeatIds
      : [entry.scene.entryBeatId];
    const beatById = new Map(entry.scene.beats.map((b) => [b.id, b]));
    const visitedBeats = visited
      .map((id) => beatById.get(id))
      .filter((b): b is NonNullable<typeof b> => Boolean(b));

    for (const b of visitedBeats) {
      const fragments: string[] = [];
      if (b.narration) fragments.push(`旁白：${b.narration}`);
      if (b.line) fragments.push(`${b.speaker ?? "?"}：${b.line}`);
      if (fragments.length) lines.push("  " + fragments.join(" / "));
    }

    if (entry.exit) {
      if (entry.exit.kind === "choice") {
        lines.push(
          `  玩家最终选择：${entry.exit.label}（去往：${entry.exit.nextSceneSeed}）`,
        );
      } else {
        lines.push(`  玩家自由动作：${entry.exit.action}`);
      }
    }
    parts.push(lines.join("\n"));
  });

  const last = session.history.at(-1);
  const lastExit = last?.exit;
  if (lastExit) {
    if (lastExit.kind === "choice") {
      parts.push(
        `\n请基于「玩家在上一场选择了：${lastExit.label}」，生成下一个场景（参考种子：${lastExit.nextSceneSeed}）。`,
      );
    } else {
      parts.push(
        `\n请基于「玩家自由动作：${lastExit.action}」，生成下一个场景。`,
      );
    }
  } else {
    parts.push("\n请生成下一个场景。");
  }

  parts.push("严格以 JSON 格式返回。");
  return parts.join("\n");
}

function collectPriorSceneKeys(session: Session): string[] {
  const seen = new Set<string>();
  for (const entry of session.history) {
    const k = entry.scene.sceneKey;
    if (k) seen.add(k);
  }
  return Array.from(seen);
}

// ──────────────────────────────────────────────────────────────────────
//  2. CharacterDesigner (角色设定师) — designs one new character.
//
//  Receives a character NAME (extracted by the Writer's activeCharacters)
//  and produces BOTH the English visual card AND the Chinese voice card
//  in a single LLM call. Bundling these two is intentional: a single agent
//  that "knows who this character is" produces internally-consistent
//  appearance + vocal personality, whereas split agents tend to diverge
//  (e.g., gentle-looking character with energetic voice).
// ──────────────────────────────────────────────────────────────────────

export const CHARACTER_DESIGNER_SYSTEM = `你是视觉小说的「角色设定师」。给你一个**新登场角色的名字**，你要为这个角色同时设计两份卡片：
1. **视觉设定卡（英文）**——给生图模型 FLUX 用，遵循 prompt engineering 风格
2. **音色设定卡（中文）**——给小米 MiMo 配音设计用

两份卡片要描绘**同一个人**——外貌温柔的人不该被配上张扬聒噪的嗓音；冷酷干练的人不该用甜软糯的童声。先在心里想清楚这个人的整体气质，再分两面落笔。

视觉设定卡 visualDescription 规则：
- **必须完全用英文**
- 风格：用形容词 + 短语，**英文逗号分隔**，符合 FLUX/Stable Diffusion prompt 习惯
- 包含：年龄段、发型发色、眼睛 / 神情基调、面部特征、标志性服饰（款式 + 配色 + 花纹）、整体气质
- **不要写瞬时姿势或表情**（这些由编剧/分镜每帧实时控制）
- **必须融入全局画风** styleGuide 的美术指向（比如 styleGuide 是「赛博朋克」时，服饰要赛博朋克化）
- 长度：80–150 个英文词为宜
- 不要包含背景环境（这不是场景图，是角色立绘卡）

音色设定卡 voiceDescription 规则：
- **必须以明确性别开头**："女性，…" / "男性，…"
- 随后描述：年龄段（如「约17岁少女」「30 出头男性」）、音色质感、性格情绪基调、语速节奏、人设腔调、口音方言
- 用中文，整段连续描述，不分段
- 长度：50–80 个中文字为宜
- 例："女性，约17岁少女，音色清亮带点稚嫩甜美，性格开朗外向但容易害羞，语速偏快，标准普通话"

必须输出严格 JSON：
{
  "visualDescription": "English visual card, comma-separated tags...",
  "voiceDescription": "中文音色卡，以性别开头..."
}

不要输出 JSON 以外的任何文本。`;

export function buildCharacterDesignerUserMessage(
  charName: string,
  session: Session,
): string {
  const parts: string[] = [];
  parts.push(`角色名：${charName}`);
  parts.push(`世界观：${session.worldSetting}`);
  parts.push(`全局美术画风：${session.styleGuide}`);

  const others = session.characters.filter((c) => c.visualDescription);
  if (others.length > 0) {
    parts.push("\n已设定角色（外貌应与他们有区分）：");
    for (const c of others) {
      parts.push(`- ${c.name}: ${c.visualDescription}`);
    }
  }

  parts.push(
    "\n请为该角色同时设计 visualDescription（英文）和 voiceDescription（中文），严格以 JSON 格式返回。",
  );
  return parts.join("\n");
}

// ──────────────────────────────────────────────────────────────────────
//  3. Cinematographer (分镜导演) — composes the visual frame.
//
//  Reads the Writer's sceneSummary + active characters and produces the
//  English compositional prompt fed to FLUX. Does NOT describe the
//  characters themselves (those archetypes are appended at the Painter
//  stage from session.characters.visualDescription). Only describes the
//  ENVIRONMENT, lighting, camera framing, and how the characters are
//  positioned within the frame.
// ──────────────────────────────────────────────────────────────────────

export const CINEMATOGRAPHER_SYSTEM = `你是视觉小说的「分镜导演」。给你编剧的当前场景概要、活跃角色名单和他们在场景里的姿态描述，以及**入口 beat 的 speaker 信息**（用来决定镜头语言）。你的任务是**只用英文**写一段**纯环境+构图**的描述（integratedPrompt），交给画师作为出图主提示词。

你**不要**写角色的外貌细节——发色、服饰、脸型这些由其他 agent 提供，画师会把"角色档案卡"附加到你的 integratedPrompt 后面。你只关心：
- **环境**：地点、时间、天气、光线、空间细节（什么家具/植物/物件）
- **构图 / 镜头**：景别（wide shot / medium shot / close-up / over-the-shoulder）、机位、视角
- **人物在画面中的位置和姿态**（不写脸 / 不写穿什么——只写"哪个角色站在哪儿、在做什么"）
- **氛围**：情绪基调、色调、影调（warm dusk / cold neon / soft morning light）

═══════════════════════════════════════════════════════════════════
玩家视角硬规则（与画面相关，必须严格遵守）
═══════════════════════════════════════════════════════════════════
- 玩家本人**永远不出现在画面里**——不画 player 的身体、手、肩膀、背影、剪影、脚、头发
- integratedPrompt 中**绝对禁止**出现下列英文（或中文等价）：
    "first-person view" · "POV of the protagonist" · "player's hand / arm / shoulder / back"
    "protagonist visible" · "from the player's perspective" · "MC" · "player's silhouette"
- 镜头是一个"隐形的观察者位置"——可以位于玩家的视角附近（NPC 像在看玩家），但**绝不画出玩家本身**

═══════════════════════════════════════════════════════════════════
动态镜头策略（根据入口 beat 的 speaker 字段选择镜头）
═══════════════════════════════════════════════════════════════════
你会收到 entryBeatSpeaker 字段。按以下规则选镜头：

【entryBeatSpeaker = 某个 NPC 名字】 → NPC 正在对玩家说话
- 优先 **close-up 或 medium close-up**，NPC 看向画面外（= 看玩家）
- 关键英文：close-up / medium close-up, looking toward camera, eyes meeting the viewer,
  direct gaze, lips parted mid-speech
- 制造"她正在对你说话"的代入感（galgame 经典直视镜头）

【entryBeatSpeaker = "你"】 → 玩家正在对 NPC 说话
- 优先 **medium shot**，NPC 居中，做"在听玩家说话"的姿态
- 关键英文：medium shot, attentively listening, facing the camera,
  head slightly tilted, expression of attention
- ❌ 不要写 over-the-shoulder（因为这会暗示画出玩家肩膀，违反 POV 规则）

【entryBeatSpeaker 为空】 → 纯环境 / 旁白 beat
- 优先 **wide establishing shot**，展现环境氛围
- 关键英文：wide establishing shot, atmospheric mood, environmental detail
- 如果有 NPC 在场，他们可以处于远处 / 中景 / 自然状态（不必看镜头）

【entryBeatActive 有多个角色】 → 群像
- 使用 **medium group shot 或 medium wide shot**，多人在一个框内
- 关键英文：medium group shot, two-shot / three-shot, characters arranged in the frame

═══════════════════════════════════════════════════════════════════
输出 JSON 结构
═══════════════════════════════════════════════════════════════════
{
  "shotType": "close-up / medium shot / wide establishing / medium group shot / ...",
  "integratedPrompt": "English. Environment + composition + character positioning + camera language. No dialogue boxes, no UI. 80-150 words."
}

写作要求：
- integratedPrompt **必须英文**，遵循 FLUX prompt engineering 习惯（形容词 + 短语，英文逗号分隔，必要时短句）
- 提到具体角色时**只用其名字 + 动作**，例如 "Natsumi standing by the window, head slightly bowed"——绝不要写她长什么样
- 不描述任何 UI、字幕、对话框、边框
- 不描述图像之外的事情（不要写"this scene depicts..."这种 meta 句）
- 长度 80–150 英文词

不要输出 JSON 以外的任何文本。`;

export function buildCinematographerUserMessage(
  sceneSummary: string,
  styleGuide: string,
  entryBeatActive: BeatActiveCharacter[],
  entryBeatSpeaker: string | undefined,
  priorSceneKey: string | undefined,
  currentSceneKey: string | undefined,
): string {
  const parts: string[] = [];
  parts.push(`全局美术画风：${styleGuide}`);
  parts.push(`\n当前场景（来自编剧）：${sceneSummary}`);

  if (entryBeatActive.length > 0) {
    parts.push("\n开场画面里的角色及其姿态：");
    for (const c of entryBeatActive) {
      parts.push(`- ${c.name}：${c.pose ?? "（无具体姿态描述）"}`);
    }
  } else {
    parts.push("\n开场画面里没有角色（纯环境）。");
  }

  // entryBeatSpeaker drives the dynamic camera policy (see CINEMATOGRAPHER_SYSTEM).
  // "你" means the player is speaking; an NPC name means an NPC is speaking;
  // empty means no dialog (pure environment / narration beat).
  if (entryBeatSpeaker === "你") {
    parts.push(
      '\n开场 beat 是**玩家说话**（speaker = "你"）——按动态镜头策略：medium shot，NPC 居中、做听玩家说话的姿态、看向画面外。**绝不要画出玩家**。',
    );
  } else if (entryBeatSpeaker) {
    parts.push(
      `\n开场 beat 是 **${entryBeatSpeaker} 在对玩家说话**（speaker = "${entryBeatSpeaker}"）——按动态镜头策略：close-up 或 medium close-up，${entryBeatSpeaker} 看向画面外（看玩家），眼神交流。`,
    );
  } else {
    parts.push(
      "\n开场 beat 没有 speaker（纯旁白/环境）——按动态镜头策略：wide establishing shot 展现环境氛围。",
    );
  }

  if (priorSceneKey && currentSceneKey && priorSceneKey === currentSceneKey) {
    parts.push(
      `\n注意：上一场和本场 sceneKey 都是 "${currentSceneKey}"——画师会把上一张场景图作为 referenceImages 之一锚定同一空间。你的 integratedPrompt 应该**强调连续性**，描述时段/情绪/构图的细微变化，而不是完全重新设定空间。`,
    );
  }

  parts.push("\n请输出 shotType + integratedPrompt，严格以 JSON 格式返回。");
  return parts.join("\n");
}

// ──────────────────────────────────────────────────────────────────────
//  4. Painter (画师) — final image prompt assembly.
//
//  Not an LLM agent — a pure prompt-building function that combines the
//  Cinematographer's integratedPrompt with character archetype blocks
//  (visual cards) and the standard FLUX constraints.
// ──────────────────────────────────────────────────────────────────────

export function buildPainterPrompt(
  integratedPrompt: string,
  styleGuide: string,
  characters: { name: string; visualDescription?: string }[],
): string {
  const archetypeBlock = characters
    .filter((c) => c.visualDescription)
    .map((c) => `[CHARACTER: ${c.name}]\n${c.visualDescription}`)
    .join("\n\n");

  const archetypeSection = archetypeBlock
    ? `\n\nCHARACTER ARCHETYPES (anchor identity, outfit, and style across scenes — keep each character visually identical to their archetype):\n${archetypeBlock}`
    : "";

  return `Generate a cinematic landscape background illustration, 16:9 widescreen (1792x1024).

ART STYLE: ${styleGuide}

SCENE COMPOSITION (from cinematographer — environment + camera framing + character positioning):
${integratedPrompt}${archetypeSection}

STRICT RULES — NEVER violate these:
- DO NOT draw any dialogue boxes, speech bubbles, text panels, or any rectangular overlay.
- DO NOT draw any buttons, choice options, menu items, or interactive UI elements.
- DO NOT render any Chinese or English text anywhere in the image.
- DO NOT add any HUD, interface chrome, or game UI elements.
- The image is a PURE BACKGROUND SCENE ONLY. All UI will be added as HTML on top.
- 16:9 LANDSCAPE orientation — wider than tall. No portrait or square output.
- Leave the bottom 35% of the frame relatively uncluttered (darker or softer) so overlaid UI panels remain readable.
- Characters or key scene elements should be positioned in the upper 65% of the frame.
- Maintain character identity exactly as specified in CHARACTER ARCHETYPES — same face, same hairstyle, same outfit across every scene.

PLAYER POV RULES — the player / protagonist is the unseen viewer:
- The player / protagonist is NEVER visible in the frame — no body parts, no hands, no shoulders, no back of head, no silhouette, no feet, no hair.
- DO NOT use first-person POV that implies the player's body in frame.
- When an NPC is speaking to the player, they SHOULD look toward the camera (toward the player's implied position) — this creates eye contact without showing the player.
- The camera position represents the player's gaze; only NPCs, scenery, and objects are rendered.`;
}

// Character portrait prompt — for the per-character base image generated
// once when the CharacterDesigner introduces a new character. The portrait
// is used both as a client-side asset (立绘登场) and as a referenceImages
// entry when rendering later scenes for visual consistency.
export function buildCharacterPortraitPrompt(
  charName: string,
  visualDescription: string,
  styleGuide: string,
): string {
  return `Character concept portrait sheet, single character, full-body or upper-body composition, neutral standing pose, looking toward camera, neutral expression, plain neutral background (no environment, no scenery).

ART STYLE: ${styleGuide}

CHARACTER (${charName}):
${visualDescription}

STRICT RULES:
- ONE character only — no other people, no crowd, no background characters.
- Plain neutral background (off-white or soft gradient). NO environment, NO furniture, NO props beyond what's worn.
- Neutral, calm pose and expression — this is a reference sheet, not a dramatic shot.
- NO text, NO UI, NO watermark, NO border.
- The character should be clearly visible and centered, the pose natural and relaxed.
- 16:9 landscape orientation.`;
}

// ──────────────────────────────────────────────────────────────────────
//  Insert-Beat — given a freeform vision action that is judged to stay
//  *within* the current scene, generate one transient beat.
//  Single-agent path; no character design / no rendering involved.
// ──────────────────────────────────────────────────────────────────────

export const INSERT_BEAT_SYSTEM = `你是视觉小说编剧。玩家在当前场景内做了一个**不会换场景的自由动作**（比如看一眼桌上的相框、想了想刚才那句话）。请基于此动作，写出一个**单独的、过渡性的 beat**：可以是旁白、角色台词、或两者结合。

文本风格约束：
- narration / line 用中文，**纯净可显示文本**，不要写 (叹气) 这类配音标注
- narration 与 line 加起来 ≤80 字
- 不要打破当前场景的物理状态（玩家仍在原地、对面仍是同一个角色）
- 不要生成选项或下一步指引 —— 玩家点击会自然回到原 beat

speaker 字段允许的取值**只有两种**（与主路径 Writer 一致 — Pattern B galgame 标准）：
1. **已登记角色**里的 NPC 真名（**绝不允许引入新角色**）
2. **"你"** — 玩家本人在自言自语 / 说一句过渡性的话（对白框显示，但不调 TTS）

其它任何 POV 变体（玩家 / 我 / 主角 / protagonist / player / MC / I / me）**一律错误**，请用 "你" 代替。

- 如果有 line 且 speaker = NPC，**必须**给出 lineDelivery（配音导演指令）
- 如果有 line 且 speaker = "你"，lineDelivery 可以留空（玩家对白不调 TTS）

必须输出严格 JSON：
{
  "narration": "...",
  "speaker": "...",
  "line": "...",
  "lineDelivery": "..."
}

narration/speaker/line/lineDelivery 都可为空字符串。不要输出 JSON 以外的任何文本。`;

export function buildInsertBeatUserMessage(
  session: Session,
  freeformAction: string,
): string {
  const parts: string[] = [];
  parts.push(`世界观：${session.worldSetting}`);

  if (session.characters.length > 0) {
    parts.push("\n已登记角色（speaker 只能用这些名字）：");
    for (const c of session.characters) {
      parts.push(`- ${c.name}`);
    }
  }

  const current = session.history.at(-1);
  if (current) {
    const scene: Scene = current.scene;
    parts.push(`\n当前场景：${scene.scenePrompt}`);
    const lastBeatId = current.visitedBeatIds.at(-1) ?? scene.entryBeatId;
    const lastBeat = scene.beats.find((b) => b.id === lastBeatId);
    if (lastBeat) {
      const recent: string[] = [];
      if (lastBeat.narration) recent.push(`旁白：${lastBeat.narration}`);
      if (lastBeat.line) recent.push(`${lastBeat.speaker ?? "?"}：${lastBeat.line}`);
      if (recent.length) parts.push(`刚才发生：${recent.join(" / ")}`);
    }
  }

  parts.push(`\n玩家此刻的自由动作：${freeformAction}`);
  parts.push("\n请生成一个过渡性 beat，严格以 JSON 格式返回。");
  return parts.join("\n");
}

// ──────────────────────────────────────────────────────────────────────
//  Vision — interprets a background click and classifies the action.
//  Unchanged from staging (UI choices live in HTML, vision only judges
//  background clicks).
// ──────────────────────────────────────────────────────────────────────

export const VISION_SYSTEM_PROMPT = `你是视觉理解助手。玩家在视觉小说的背景图上点击了红色圆点位置（HTML 上的选项按钮不会走到你这里）。你的任务是：
1. 看清红点指向画面里的什么（物件、角色、空间、远处的方向）
2. 推断玩家想干什么
3. 判断这个动作是「场内探索」（不该换图）还是「场景切换」（要换图）

判断准则：
- "insert-beat"（场内探索）：观察画面里某个细节、自言自语、和当前角色继续互动、看一眼某个物件
- "change-scene"（场景切换）：走向画面深处的门 / 走廊、转头看向新方向（视角变了）、点了远处的另一个空间、暗示时间跳跃的物件（如时钟）

必须输出严格 JSON：
{
  "freeformAction": "玩家想做什么的一句中文描述，例如「想拿起桌上的钥匙」",
  "classify": "insert-beat" 或 "change-scene",
  "reasoning": "一句话说明判断理由"
}

不要输出 JSON 以外的任何文本。`;

export function buildVisionUserPrompt(scene: Scene | null): string {
  if (!scene) return "请判断玩家意图，并以 JSON 格式返回。";
  return `当前场景描述：${scene.scenePrompt}

红点位置即为玩家点击位置。请判断玩家意图与分类，以 JSON 格式返回。`;
}

export type PainterCharacterInput = Pick<Character, "name" | "visualDescription">;
