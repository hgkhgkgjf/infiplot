// Cloud story repository — server-only Supabase persistence skeleton for the
// COMMERCIAL build. Mirrors the local repository (lib/persistence/localStore.ts)
// method-for-method so next-phase local-first bidirectional sync can treat the
// cloud as a layer over the local store rather than a parallel branch.
//
// This phase is a SKELETON: no API route exposes these functions and no client
// calls them. When AUTH_ENABLED is false (the open-source build) every method
// short-circuits to a safe value on its first line and never touches Supabase.
//
// Isolation is by RLS only: the SSR client carries the user's anon key + cookie,
// and every public.stories policy is keyed on auth.uid() = user_id — so no
// service_role key is used and no query needs a manual user filter for safety
// (the explicit .eq("user_id") below is belt-and-suspenders + index alignment).

import "server-only";

import type { Session } from "@infiplot/types";
import { coerceOrientation } from "@infiplot/types";
import { AUTH_ENABLED } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { SlimStoryBlob, StoryMeta } from "./types";
import { coerceEpoch } from "./types";

/** One row of public.stories (snake_case columns ↔ SlimStoryBlob + sync meta). */
type StoryRow = {
  id: string;
  user_id: string;
  world_setting: string;
  style_guide: string;
  orientation: string;
  scene_count: number;
  rev: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  session_jsonb: Session;
};

/** Resolve the authenticated user's id (= auth.uid()) from the SSR session, or
 *  null when unauthenticated. Repository-level (no NextResponse) so callers stay
 *  framework-agnostic; methods short-circuit to safe values on null. */
async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const claims = await supabase.auth.getClaims();
    return claims.data?.claims?.sub ?? null;
  } catch {
    return null;
  }
}

function rowToBlob(row: StoryRow): SlimStoryBlob {
  return {
    id: row.id,
    worldSetting: row.world_setting ?? "",
    styleGuide: row.style_guide ?? "",
    orientation: coerceOrientation(row.orientation),
    sceneCount: row.scene_count ?? 0,
    rev: row.rev ?? 1,
    session: row.session_jsonb,
  };
}

function rowToMeta(row: StoryRow): StoryMeta {
  return {
    id: row.id,
    worldSetting: row.world_setting ?? "",
    styleGuide: row.style_guide ?? "",
    orientation: coerceOrientation(row.orientation),
    sceneCount: row.scene_count ?? 0,
    // coerceEpoch (not a raw new Date().getTime()) guards against an unparseable
    // timestamptz string yielding NaN, which would render as "Invalid Date" and
    // crash any client doing `new Date(updatedAt).getTime()`. Ordering is done
    // SQL-side (.order("updated_at") in cloudListStories), so these JS values
    // don't drive the sort. Same shared helper the local store uses.
    createdAt: coerceEpoch(row.created_at, 0),
    updatedAt: coerceEpoch(row.updated_at, 0),
  };
}

// ── Public API ──────────────────────────────────────────────────────────────
//
// CONTRACT NOTE (CR-15): these methods are the cloud COUNTERPARTS of
// lib/persistence/localStore.ts, but their return shapes are intentionally NOT
// identical — the local store returns rich StoryRecord/Session values (carrying
// schemaVersion/createdAt/updatedAt/deletedAt/syncState), while the cloud store
// returns the leaner SlimStoryBlob. When next-phase bidirectional sync lands it
// must map StoryRecord ↔ SlimStoryBlob ↔ Session in one reconciliation layer
// rather than assuming a single shared shape; the intended convergence is a
// common envelope (SlimStoryBlob + sync-meta) at both edges. Documented here so
// the asymmetry is a known, bounded cost, not a surprise.

/** Upsert one story for the current user. onConflict targets the `id` PK; the
 *  caller-supplied rev/updated_at are written verbatim and created_at is left to
 *  the DB default (insert only). NOTE (CR-10): this is last-write-wins — there is
 *  no `updated_at`-monotonic guard, so a slow concurrent writer can clobber newer
 *  cloud state; the next-phase sync layer must add an optimistic-concurrency
 *  predicate (e.g. only overwrite when excluded.updated_at > stories.updated_at)
 *  before this is wired to real multi-device traffic. Returns the stored blob, or
 *  null when auth is off / unauthenticated / the write failed (incl. an RLS-hidden
 *  cross-user id collision surfacing as a PK violation). */
export async function cloudSaveStory(
  blob: SlimStoryBlob,
): Promise<SlimStoryBlob | null> {
  if (!AUTH_ENABLED) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stories")
      .upsert(
        {
          id: blob.id,
          user_id: userId,
          world_setting: blob.worldSetting ?? "",
          style_guide: blob.styleGuide ?? "",
          orientation: coerceOrientation(blob.orientation),
          scene_count: blob.sceneCount ?? 0,
          rev: blob.rev ?? 1,
          updated_at: new Date().toISOString(),
          deleted_at: null,
          session_jsonb: blob.session,
        },
        { onConflict: "user_id,id" },
      )
      .select()
      .single();
    if (error || !data) return null;
    return rowToBlob(data as StoryRow);
  } catch {
    return null;
  }
}

/** Load one story's slim blob for the current user. Tombstoned / absent / not
 *  owned (RLS) → null. */
export async function cloudLoadStory(id: string): Promise<SlimStoryBlob | null> {
  if (!AUTH_ENABLED) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stories")
      .select()
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) return null;
    return rowToBlob(data as StoryRow);
  } catch {
    return null;
  }
}

/** List the current user's non-tombstoned stories as lightweight metadata,
 *  newest first (mirrors localStore.listStories). Auth off / unauth → []. */
export async function cloudListStories(): Promise<StoryMeta[]> {
  if (!AUTH_ENABLED) return [];
  const userId = await currentUserId();
  if (!userId) return [];
  try {
    const supabase = await createClient();
    // Explicit column list (not select()) so the list query doesn't pull the
    // bulky session_jsonb — rowToMeta only needs the denormalized metadata.
    const { data, error } = await supabase
      .from("stories")
      .select(
        "id, world_setting, style_guide, orientation, scene_count, created_at, updated_at",
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error || !data) return [];
    return (data as StoryRow[]).map(rowToMeta);
  } catch {
    return [];
  }
}

/** Soft-delete one story (set the tombstone) for the current user so the
 *  deletion can propagate. Absent / not owned / write failed → false. */
export async function cloudSoftDeleteStory(id: string): Promise<boolean> {
  if (!AUTH_ENABLED) return false;
  const userId = await currentUserId();
  if (!userId) return false;
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("stories")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id");
    if (error || !data || data.length === 0) return false;
    return true;
  } catch {
    return false;
  }
}
