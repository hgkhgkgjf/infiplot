import { packDoc } from "@/lib/galleryCrypto";

export const runtime = "nodejs";

const MAX_DOC_BYTES = 5_000_000;

// Encrypt a gallery doc into the shareable `.infiplot` binary format.
// Stateless: input is the doc string, output is the encrypted bytes — server
// keeps nothing. The secret must be configured (no insecure fallback).
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.GALLERY_SECRET;
  if (!secret) {
    return Response.json(
      { error: "图集分享未启用 (GALLERY_SECRET 未配置)" },
      { status: 503 },
    );
  }

  let docStr: string;
  try {
    const body = (await req.json()) as { docStr?: unknown };
    if (typeof body.docStr !== "string") {
      return Response.json({ error: "Missing docStr" }, { status: 400 });
    }
    docStr = body.docStr;
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (new TextEncoder().encode(docStr).byteLength > MAX_DOC_BYTES) {
    return Response.json(
      { error: "图集数据太大,无法打包分享" },
      { status: 413 },
    );
  }

  const bytes = await packDoc(docStr, secret);
  // Copy into a fresh ArrayBuffer so TS 5.7's stricter BodyInit typing accepts
  // it (Uint8Array.buffer is ArrayBufferLike, which the BodyInit overloads
  // don't narrow). Cheap — one extra alloc + memcpy of ~50-200KB.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Response(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
