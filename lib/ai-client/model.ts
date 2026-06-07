import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderConfig, ProviderProtocol } from "@infiplot/types";
import { normalizeBaseUrl } from "./normalizeUrl";

export function resolveProtocol(config: ProviderConfig): ProviderProtocol {
  return config.provider ?? "openai_compatible";
}

export function createLanguageModel(config: ProviderConfig, protocol: ProviderProtocol) {
  const baseURL = normalizeBaseUrl(config.baseUrl, protocol);
  switch (protocol) {
    case "anthropic":
      return createAnthropic({ apiKey: config.apiKey, baseURL })(config.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey: config.apiKey, baseURL })(config.model);
    case "openai_compatible":
    case "openai":
    default:
      return createOpenAI({ apiKey: config.apiKey, baseURL }).chat(config.model);
  }
}
