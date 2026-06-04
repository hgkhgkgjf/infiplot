import type { EngineConfig, TtsConfig } from "@infiplot/types";

function readVar(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function readOptionalVar(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

function loadTtsConfig(): TtsConfig | undefined {
  const baseUrl = readOptionalVar("TTS_BASE_URL");
  const apiKey = readOptionalVar("TTS_API_KEY");
  const speechModel = readOptionalVar("TTS_SPEECH_MODEL");

  // Missing any → TTS disabled (game runs silently).
  if (!baseUrl || !apiKey || !speechModel) return undefined;

  return { baseUrl, apiKey, speechModel };
}

export function loadEngineConfig(headers?: Headers): EngineConfig {
  const config: EngineConfig = {
    text: {
      baseUrl: readVar("TEXT_BASE_URL"),
      apiKey: readVar("TEXT_API_KEY"),
      model: readVar("TEXT_MODEL"),
    },
    image: {
      baseUrl: readVar("IMAGE_BASE_URL"),
      apiKey: readVar("IMAGE_API_KEY"),
      model: readVar("IMAGE_MODEL"),
    },
    vision: {
      baseUrl: readVar("VISION_BASE_URL"),
      apiKey: readVar("VISION_API_KEY"),
      model: readVar("VISION_MODEL"),
    },
    tts: loadTtsConfig(),
    mockImage: readOptionalVar("MOCK_IMAGE") === "true",
  };

  const byoHeader = headers?.get("x-byo-api");
  if (byoHeader) {
    try {
      const byo = JSON.parse(byoHeader);
      if (byo.llm?.enabled) {
        if (byo.llm.endpoint) config.text.baseUrl = byo.llm.endpoint;
        if (byo.llm.apiKey) config.text.apiKey = byo.llm.apiKey;
        if (byo.llm.model) config.text.model = byo.llm.model;

        // Also override vision if llm is enabled
        if (byo.llm.endpoint) config.vision.baseUrl = byo.llm.endpoint;
        if (byo.llm.apiKey) config.vision.apiKey = byo.llm.apiKey;
        if (byo.llm.model) config.vision.model = byo.llm.model;
      }
      if (byo.painter?.enabled) {
        if (byo.painter.endpoint) config.image.baseUrl = byo.painter.endpoint;
        if (byo.painter.apiKey) config.image.apiKey = byo.painter.apiKey;
        if (byo.painter.model) config.image.model = byo.painter.model;
      }
    } catch (e) {
      console.error("Failed to parse x-byo-api header in loadEngineConfig:", e);
    }
  }

  return config;
}
