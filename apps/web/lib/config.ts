import type { EngineConfig } from "@yume/types";

function readVar(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export function loadEngineConfig(): EngineConfig {
  return {
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
  };
}
