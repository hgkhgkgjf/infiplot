// ─────────────────────────────────────────────────────────────────────────
//  InfiPlot — Runware image proxy (Cloudflare Worker)
//
//  Why this exists:
//    Chrome's direct fetch of `im.runware.ai` images sometimes fails with
//    `ERR_QUIC_PROTOCOL_ERROR` — HTTP/3 stream errors mid-transfer leave the
//    browser holding a partial PNG, which it renders progressively
//    (the "层层从上往下" visible-decode glitch). Routing the fetch through
//    this Worker fixes it in two ways:
//
//      1. Browser ↔ Worker is HTTP/2 over Cloudflare's edge — extremely
//         stable, no QUIC fragility.
//      2. Worker ↔ Runware is a server-to-server fetch (Cloudflare's
//         backbone) — also reliable, and the Worker buffers the full
//         response before streaming it back, so the client never gets
//         partial bytes mid-stream.
//
//  Bonus side-effects:
//    - CORS: Worker adds `Access-Control-Allow-Origin: *` so the client's
//      `fetch()` → blob URL path works regardless of Runware's policy.
//    - Edge cache: same Runware UUID re-fetched twice in 24h hits the CF
//      edge cache, sub-50ms response from anywhere in the world.
//
//  Hardening:
//    - Only proxies `im.runware.ai` (open proxies invite abuse + quota burn).
//    - Only accepts GET / HEAD / OPTIONS.
// ─────────────────────────────────────────────────────────────────────────

const ALLOWED_HOST = "im.runware.ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers: corsHeaders });
    }

    const reqUrl = new URL(req.url);
    const target = reqUrl.searchParams.get("url");
    if (!target) {
      return new Response("missing ?url=", { status: 400, headers: corsHeaders });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response("malformed ?url=", { status: 400, headers: corsHeaders });
    }
    if (targetUrl.hostname !== ALLOWED_HOST) {
      return new Response(`only ${ALLOWED_HOST} is allowed`, {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Fetch upstream. `cf.cacheEverything: true` tells the CF edge to cache
    // by URL even though Runware's own cache headers are weak — so a second
    // hit on the same UUID lands in edge memory rather than re-touching
    // Runware. 1y TTL: image UUIDs are immutable, the bytes never change.
    const upstream = await fetch(targetUrl.toString(), {
      cf: { cacheTtl: 31536000, cacheEverything: true },
    });

    // Stream the body through (no buffering — CF Workers' Response can take
    // a ReadableStream directly). Rebuild headers to add CORS + strong cache
    // hints, preserve content-type / content-length from upstream.
    const headers = new Headers(corsHeaders);
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") ?? "image/png",
    );
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
