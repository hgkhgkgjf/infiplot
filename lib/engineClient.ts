import {
  startSession as startSessionClient,
  requestScene as requestSceneClient,
  visionDecide as visionDecideClient,
  classifyFreeform as classifyFreeformClient,
  requestInsertBeat as requestInsertBeatClient,
} from "@infiplot/engine";
import {
  readStoredModelConfig,
  resolveEngineConfig,
} from "@/lib/clientModelConfig";
import { loadClientTtsConfig } from "@/lib/clientTtsConfig";
import type {
  Character,
  FreeformClassifyRequest,
  FreeformClassifyResponse,
  EngineConfig,
  InsertBeatRequest,
  InsertBeatResponse,
  SceneRequest,
  SceneResponse,
  Session,
  StartRequest,
  StartResponse,
  VisionRequest,
  VisionResponse,
} from "@infiplot/types";

function getClientConfig(): EngineConfig | null {
  const modelCfg = readStoredModelConfig();
  const ttsCfg = loadClientTtsConfig();
  if (!modelCfg) return null;
  return resolveEngineConfig(modelCfg, ttsCfg);
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthRequiredError";
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401) throw new AuthRequiredError();
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore parse failure, keep HTTP status message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ── FOT reduction helpers (server-fallback path only) ─────────────────
// The server-fallback POSTs send the whole Session over the wire. Voice
// data is bulky (~160KB/character via referenceAudioBase64) and the
// scene-generation / vision / classify pipelines never need it — voices
// are only consumed by /api/beat-audio, which receives them directly, not
// via the session. So strip voices before transport.
function stripVoicesForTransport(session: Session): Session {
  return {
    ...session,
    // Destructure voice out so the serialized payload drops the field
    // entirely (voice is optional on Character), rather than serializing
    // it as undefined/null. This is the ~160KB/character referenceAudioBase64
    // we want off the wire on the server-fallback path.
    characters: session.characters.map(({ voice: _voice, ...rest }) => rest),
  };
}

// The server strips voice from already-known characters before responding
// (see /api/scene stripKnownVoices and /api/insert-beat's blanket strip) to
// save bandwidth, so only NEW characters carry voice in the response. For
// existing characters, re-attach the voice the client already holds locally.
function mergeCharactersPreserveVoice(
  local: Character[],
  remote: Character[],
): Character[] {
  const localByName = new Map(local.map((c) => [c.name, c]));
  return remote.map((c) => {
    const prev = localByName.get(c.name);
    if (!prev) return c;
    return { ...c, voice: c.voice ?? prev.voice };
  });
}

// ── Unified entry points ───────────────────────────────────────────────
// When the browser has a BYO model config in localStorage, these call the
// client-side engine directly (talking to providers from the browser).
// Otherwise they fall back to the server-side API routes, which read
// environment variables — useful for Vercel deploys that already supply keys.

export async function startSession(req: StartRequest): Promise<StartResponse> {
  const config = getClientConfig();
  if (config) {
    return startSessionClient(config, req);
  }
  return postJson<StartResponse>("/api/start", req);
}

export async function requestScene(req: SceneRequest): Promise<SceneResponse> {
  const config = getClientConfig();
  if (config) {
    return requestSceneClient(config, req);
  }
  const data = await postJson<SceneResponse>("/api/scene", {
    ...req,
    session: stripVoicesForTransport(req.session),
  });
  // Server stripped known-character voices for bandwidth — re-attach the
  // voices we already hold so fetchBeatAudio can synth them.
  data.characters = mergeCharactersPreserveVoice(req.session.characters, data.characters);
  return data;
}

export async function visionDecide(req: VisionRequest): Promise<VisionResponse> {
  const config = getClientConfig();
  if (config) {
    return visionDecideClient(config, req);
  }
  return postJson<VisionResponse>("/api/vision", {
    ...req,
    session: stripVoicesForTransport(req.session),
  });
}

export async function classifyFreeform(
  req: FreeformClassifyRequest,
): Promise<FreeformClassifyResponse> {
  const config = getClientConfig();
  if (config) {
    return classifyFreeformClient(config, req);
  }
  return postJson<FreeformClassifyResponse>("/api/classify-freeform", {
    ...req,
    session: stripVoicesForTransport(req.session),
  });
}

export async function requestInsertBeat(
  req: InsertBeatRequest,
): Promise<InsertBeatResponse> {
  const config = getClientConfig();
  if (config) {
    return requestInsertBeatClient(config, req);
  }
  const data = await postJson<InsertBeatResponse>("/api/insert-beat", {
    ...req,
    session: stripVoicesForTransport(req.session),
  });
  // /api/insert-beat strips voice from ALL characters before responding —
  // re-attach every voice the client already holds so audio keeps working.
  data.characters = mergeCharactersPreserveVoice(req.session.characters, data.characters);
  return data;
}
