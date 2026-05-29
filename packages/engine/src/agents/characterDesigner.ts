import { chat, generateImage, uploadImage } from "@yume/ai-client";
import { provisionVoice } from "@yume/tts-client";
import type {
  Character,
  CharacterVoice,
  EngineConfig,
  Session,
} from "@yume/types";
import { parseJsonLoose } from "../jsonParser";
import { mockImageBase64 } from "../mockImage";
import {
  CHARACTER_DESIGNER_SYSTEM,
  buildCharacterDesignerUserMessage,
  buildCharacterPortraitPrompt,
} from "../prompts";

// ──────────────────────────────────────────────────────────────────────
//  CharacterDesigner agent — designs ONE new character end-to-end.
//
//  Pipeline (per character, all the slow parts are parallelized):
//
//    1. LLM call — designs BOTH visual + voice cards in one shot
//       (intentional: same agent thinks about who this character IS,
//        which keeps appearance and vocal personality coherent)
//
//    2. In parallel:
//       a. Image gen — base portrait from visualDescription + styleGuide
//          then upload to Runware → get UUID for cheap re-reference
//       b. Voice provisioning — Xiaomi MiMo voicedesign from voiceDescription
//          → reference audio for later voiceclone synth
//
//    3. Returns merged Character ready to be added to session.characters
//
//  Each step degrades gracefully — if image gen fails we return the
//  character without a portrait; if voice gen fails we return without
//  voice. The game keeps running even when sub-components fail.
// ──────────────────────────────────────────────────────────────────────

type CharacterDesignOutput = {
  visualDescription?: string;
  voiceDescription?: string;
};

// TEMP: per-phase timing for latency diagnosis. Same convention as the
// orchestrator's tlog. Remove after we have data on real-world numbers.
function tlog(label: string, t0: number): void {
  console.log(`${label}: ${Date.now() - t0}ms`);
}

async function runDesignLLM(
  config: EngineConfig,
  session: Session,
  charName: string,
): Promise<CharacterDesignOutput> {
  const raw = await chat(
    config.text,
    [
      { role: "system", content: CHARACTER_DESIGNER_SYSTEM },
      {
        role: "user",
        content: buildCharacterDesignerUserMessage(charName, session),
      },
    ],
    { temperature: 0.7, responseFormat: "json_object" },
  );
  return parseJsonLoose<CharacterDesignOutput>(raw);
}

// Generate the per-character base portrait and upload it. The portrait is
// a "concept sheet" — single character, neutral pose, plain background —
// so it works well as a Runware referenceImages anchor for later scenes.
//
// Returns both the base64 (for client-side asset use, e.g., 立绘登场
// animations) and the Runware UUID (for cheap referencing in subsequent
// Painter calls without resending the 100KB+ base64 each time).
//
// The upload step is best-effort: if it fails, we still return the base64
// so the next scene can pass it as a referenceImages entry directly (just
// pays the bandwidth cost each call instead of once).
async function renderAndUploadPortrait(
  config: EngineConfig,
  charName: string,
  visualDescription: string,
  styleGuide: string,
): Promise<{ basePortraitBase64?: string; basePortraitUuid?: string }> {
  let base64: string;
  try {
    if (config.mockImage) {
      base64 = await mockImageBase64();
    } else {
      const prompt = buildCharacterPortraitPrompt(
        charName,
        visualDescription,
        styleGuide,
      );
      base64 = await generateImage(config.image, prompt);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[characterDesigner] portrait gen failed for ${charName}: ${msg}`);
    return {}; // no portrait at all — degrade gracefully
  }

  // Skip upload in mock mode — the mock image is the same static SVG every
  // time and uploading it gives us a UUID that points to a useless asset.
  if (config.mockImage) {
    return { basePortraitBase64: base64 };
  }

  try {
    const uuid = await uploadImage(config.image, base64);
    return { basePortraitBase64: base64, basePortraitUuid: uuid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[characterDesigner] portrait upload failed for ${charName}: ${msg} — will pass base64 in subsequent calls`,
    );
    return { basePortraitBase64: base64 };
  }
}

async function provisionVoiceSafe(
  config: EngineConfig,
  voiceDescription: string,
  charName: string,
): Promise<CharacterVoice | undefined> {
  if (!config.tts) return undefined;
  try {
    return await provisionVoice(config.tts, voiceDescription);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[characterDesigner] voice provision failed for ${charName}: ${msg}`);
    return undefined;
  }
}

// Single-character design pipeline. Called by the orchestrator once per
// NEW character name; multiple characters in the same scene run their
// pipelines in parallel at the orchestrator level.
export async function designCharacter(
  config: EngineConfig,
  session: Session,
  charName: string,
): Promise<Character> {
  const tTotal = Date.now();

  // Step 1 — LLM design (visual + voice). Must complete first.
  const tDesign = Date.now();
  const design = await runDesignLLM(config, session, charName);
  tlog(`[charDesigner ${charName}] design LLM`, tDesign);

  const visualDescription = design.visualDescription?.trim();
  const voiceDescription =
    design.voiceDescription?.trim() ||
    `请根据角色名「${charName}」推断其性别、年龄与气质，生成最贴合的音色。所属世界观：${session.worldSetting}`;

  // Step 2 — parallel: portrait + voice provisioning.
  const tProvision = Date.now();
  const portraitPromise = visualDescription
    ? renderAndUploadPortrait(config, charName, visualDescription, session.styleGuide)
    : Promise.resolve({} as Awaited<ReturnType<typeof renderAndUploadPortrait>>);
  const voicePromise = provisionVoiceSafe(config, voiceDescription, charName);

  const [portrait, voice] = await Promise.all([portraitPromise, voicePromise]);
  tlog(`[charDesigner ${charName}] portrait+voice parallel`, tProvision);

  tlog(`[charDesigner ${charName}] TOTAL`, tTotal);

  return {
    name: charName,
    voiceDescription,
    visualDescription,
    basePortraitBase64: portrait.basePortraitBase64,
    basePortraitUuid: portrait.basePortraitUuid,
    voice,
  };
}

// Provision voice ONLY for an existing character that the LLM mentioned
// without us having designed them yet (e.g., 编剧 referenced a name that
// wasn't in `activeCharacters` but appeared as a speaker). Used by
// directInsertBeat path and as a safety net in directScene. No portrait
// is generated for these — they get a name + voice only.
export async function provisionVoiceForName(
  config: EngineConfig,
  session: Session,
  charName: string,
): Promise<Character> {
  const voiceDescription = `请根据角色名「${charName}」推断其性别、年龄与气质，生成最贴合的音色。所属世界观：${session.worldSetting}`;
  const voice = await provisionVoiceSafe(config, voiceDescription, charName);
  return { name: charName, voiceDescription, voice };
}
