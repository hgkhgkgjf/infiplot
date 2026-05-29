import type { ProviderConfig } from "@yume/types";
import { fetchWithRetry } from "./fetchWithRetry";

// Runware uses its own task-array protocol (not OpenAI-compatible).
// POST <baseUrl> with [{ taskType: "imageInference", ... }]; errors come
// back as a 200 with `errors[]`, so we have to inspect the body either way.

// FLUX img2img specifics:
// - strength < 0.8 has minimal-to-no visible effect on FLUX models (per
//   Runware docs); we default to 0.85 which leaves room to deviate while
//   still anchoring on the seed image's composition.
// - referenceImages caps at 4 per request; the FLUX.2 [klein] 9B KV model
//   (runware:400@6) accelerates multi-reference inference by ~2.5× via its
//   KV cache for reference latents (cached only WITHIN one inference run —
//   not persisted across API calls, hence the upload-once-then-reference
//   strategy below).
const DEFAULT_IMG2IMG_STRENGTH = 0.85;
const MAX_REFERENCE_IMAGES = 4;

type RunwareImageResult = {
  imageBase64Data?: string;
  imageUUID?: string;
};
type RunwareError = {
  code?: string;
  message?: string;
  parameter?: string;
};
type RunwareResponse = {
  data?: RunwareImageResult[];
  errors?: RunwareError[];
};

export type GenerateImageOptions = {
  /**
   * Reference image (UUID, plain base64, or data URI) to use as the
   * img2img starting point. When set, FLUX preserves the seed image's
   * composition and applies `strength` to allow deviation from it.
   * Used for cross-scene visual continuity when sceneKey hits.
   */
  seedImage?: string;
  /**
   * Reference images (UUIDs or base64) to condition the generation on —
   * typically character portraits to anchor identity / outfit / style
   * across scenes. Runware caps at 4; we silently truncate beyond that.
   */
  referenceImages?: string[];
  /** 0–1, FLUX needs ≥ 0.8 to actually have an effect. */
  strength?: number;
};

// ──────────────────────────────────────────────────────────────────────
//  generateImage — text-to-image (default) or img2img / multi-reference
//  when seedImage / referenceImages are supplied. Returns base64.
// ──────────────────────────────────────────────────────────────────────

export async function generateImage(
  config: ProviderConfig,
  prompt: string,
  options?: GenerateImageOptions,
): Promise<string> {
  const url = config.baseUrl.replace(/\/$/, "");

  const task: Record<string, unknown> = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    model: config.model,
    positivePrompt: prompt,
    width: 1792,
    height: 1024,
    steps: 4,
    CFGScale: 3.5,
    numberResults: 1,
    outputType: "base64Data",
    outputFormat: "PNG",
  };

  if (options?.seedImage) {
    task.seedImage = options.seedImage;
    task.strength = options.strength ?? DEFAULT_IMG2IMG_STRENGTH;
  }

  if (options?.referenceImages?.length) {
    task.referenceImages = options.referenceImages.slice(0, MAX_REFERENCE_IMAGES);
  }

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify([task]),
  });

  const text = await res.text();
  let json: RunwareResponse;
  try {
    json = JSON.parse(text) as RunwareResponse;
  } catch {
    throw new Error(`Image API error ${res.status}: ${text.slice(0, 500)}`);
  }

  if (json.errors?.length) {
    const e = json.errors[0]!;
    throw new Error(
      `Runware error [${e.code ?? "unknown"}]: ${e.message ?? "no message"}` +
        (e.parameter ? ` (parameter: ${e.parameter})` : ""),
    );
  }

  const b64 = json.data?.[0]?.imageBase64Data;
  if (!b64) {
    throw new Error(`No image in Runware response: ${text.slice(0, 300)}`);
  }
  return b64;
}

// ──────────────────────────────────────────────────────────────────────
//  uploadImage — registers a base64 image on Runware and returns its
//  UUID, so subsequent generateImage calls can pass the UUID in
//  referenceImages / seedImage instead of resending the base64 payload
//  every time. Character base portraits and scene snapshots both flow
//  through this path.
//
//  Runware exposes the imageUpload taskType for exactly this purpose.
//  Returns the UUID. Caller treats a thrown error as "fall back to
//  sending base64 next time" — non-fatal.
// ──────────────────────────────────────────────────────────────────────

export async function uploadImage(
  config: ProviderConfig,
  base64: string,
): Promise<string> {
  const url = config.baseUrl.replace(/\/$/, "");

  const body = [
    {
      taskType: "imageUpload",
      taskUUID: crypto.randomUUID(),
      image: `data:image/png;base64,${base64}`,
    },
  ];

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: RunwareResponse;
  try {
    json = JSON.parse(text) as RunwareResponse;
  } catch {
    throw new Error(`Image upload API error ${res.status}: ${text.slice(0, 500)}`);
  }

  if (json.errors?.length) {
    const e = json.errors[0]!;
    throw new Error(
      `Runware upload error [${e.code ?? "unknown"}]: ${e.message ?? "no message"}`,
    );
  }

  const uuid = json.data?.[0]?.imageUUID;
  if (!uuid) {
    throw new Error(`No UUID in upload response: ${text.slice(0, 300)}`);
  }
  return uuid;
}
