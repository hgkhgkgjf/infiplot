import { NextResponse } from "next/server";
import { coerceOrientation } from "@infiplot/types";
import { requireUser } from "@/lib/supabase/guard";
import { cloudSaveStory } from "@/lib/persistence/cloudStore";
import { coerceEpoch, type StorySyncEnvelope } from "@/lib/persistence/types";

export const runtime = "nodejs";

// Matches story-pack's 12 MB doc ceiling — a slim Session (voice +
// styleReferenceImage stripped) is far smaller, so this only rejects
// pathological payloads, never normal saves.
const MAX_PUSH_BYTES = 12_000_000;

// POST /api/stories/push — body StorySyncEnvelope → { stored, won }. Pure
// passthrough to the optimistic-concurrency RPC; won=false means a newer cloud
// row was preserved. requireUser 401s an unauthenticated commercial caller; on
// the open-source build cloudSaveStory short-circuits to { stored:null, won:false }.
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_PUSH_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let env: StorySyncEnvelope;
  try {
    env = JSON.parse(raw) as StorySyncEnvelope;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!env?.id || typeof env.id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  // Defensive coercion at the trust boundary (the slim session itself is left to
  // the client — it's reconstructible and never security-sensitive after slim).
  const result = await cloudSaveStory({
    ...env,
    orientation: coerceOrientation(env.orientation),
    updatedAt: coerceEpoch(env.updatedAt, Date.now()),
    deletedAt: env.deletedAt == null ? null : coerceEpoch(env.deletedAt, Date.now()),
  });
  return NextResponse.json(result);
}
