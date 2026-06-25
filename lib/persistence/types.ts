// Persistence wire types — local-first story storage.
//
// Shared shapes for the browser-local store (IndexedDB) and the future Supabase
// cloud store. Replaces the deleted D1 `lib/db/repositories/storyRepo` types,
// severing all dependency on Drizzle / D1. The local `StoryRecord` and the cloud
// `public.stories` row both carry the same slim `Session` blob (see
// `SlimStoryBlob`) so there is no dual data shape to reconcile when cloud sync
// is layered on next phase.

import type { Session, Orientation } from "@infiplot/types";

/** Schema version stamped on every local record — migration hook for future
 *  structural evolution of `StoryRecord`. Bump when the on-disk shape changes. */
export const STORY_SCHEMA_VERSION = 1;

/** Coerce a Date | string | number (or anything) to epoch milliseconds, falling
 *  back when the value is unparseable. Shared by the local store, the cloud store
 *  (Supabase timestamptz), and the stories list UI — every site where a timestamp
 *  crosses a storage/serialization boundary and could arrive as a non-number,
 *  guarding against the historical `t.getTime is not a function` white-screen. */
export function coerceEpoch(value: unknown, fallback: number): number {
  // Number.isFinite (not just !isNaN) so ±Infinity also falls through to the
  // fallback — new Date(Infinity).getTime() is NaN, not a usable epoch.
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const d = value instanceof Date ? value : new Date(value as string | number);
  const t = d.getTime();
  return Number.isNaN(t) ? fallback : t;
}

/** local-first sync state of a record.
 *  - "local-only": never sent to the cloud (open-source default, or pre-sync).
 *  - "synced":     in agreement with the cloud row.
 *  - "pending":    has un-propagated local changes (incl. soft-delete tombstones). */
export type SyncState = "local-only" | "synced" | "pending";

/** List-view projection of a saved story — the lightweight metadata the
 *  "我的剧情" page renders without parsing the full session blob. Migrated out of
 *  the deleted D1 `storyRepo`; timestamps are unified to epoch milliseconds
 *  (the old D1 shape used `Date` and carried `userId`/`status`, both dropped:
 *  the local layer has no account concept, and `status` was a D1 leftover). */
export type StoryMeta = {
  id: string;
  worldSetting: string;
  styleGuide: string;
  orientation: Orientation;
  sceneCount: number;
  /** epoch ms */
  createdAt: number;
  /** epoch ms */
  updatedAt: number;
};

/** The shared core payload for one saved story, identical between the local
 *  record and the (future) cloud row. `session` is the SLIM `Session` — the
 *  bulky reconstructible fields (`voice.referenceAudioBase64`,
 *  `styleReferenceImage`) are stripped before persistence by the store layer. */
export type SlimStoryBlob = {
  id: string;
  worldSetting: string;
  styleGuide: string;
  orientation: Orientation;
  sceneCount: number;
  rev: number;
  /** Slim Session (voice + styleReferenceImage stripped). Type stays `Session`;
   *  slimming is a runtime guarantee enforced by the store, not the type. */
  session: Session;
};

/** One row in the browser-local IndexedDB store (object store keyPath = "id").
 *  Carries the slim session payload plus the local-first sync-reserved
 *  metadata so cloud sync can be layered on next phase without restructuring. */
export type StoryRecord = {
  id: string;
  /** = STORY_SCHEMA_VERSION at write time. */
  schemaVersion: number;

  // ── List-view metadata (denormalized so listing needn't parse the blob) ──
  worldSetting: string;
  styleGuide: string;
  orientation: Orientation;
  sceneCount: number;

  // ── local-first sync-reserved fields ──
  /** epoch ms; set on first save, preserved across subsequent upserts. */
  createdAt: number;
  /** epoch ms; refreshed on every save. */
  updatedAt: number;
  /** Revision counter; new record = 1, bumped on each local save. */
  rev: number;
  /** Soft-delete tombstone (epoch ms) or null. Delete sets this rather than
   *  physically removing the row, so the deletion can propagate to the cloud
   *  next phase. List queries filter tombstoned records out. */
  deletedAt: number | null;
  syncState: SyncState;

  // ── Payload ──
  /** Slim Session (voice + styleReferenceImage stripped). IndexedDB
   *  structured-clones objects, so this is stored as-is (no JSON.stringify). */
  session: Session;
};
