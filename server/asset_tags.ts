// Pure helpers for asset tagging and "find similar": no I/O, so they're cheap to unit test.

export const MAX_TAGS_PER_ASSET = 12;
const MAX_TAG_LENGTH = 24;

export function splitTags(tags: string): string[] {
  return tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
}

/** Lowercases and strips a model-suggested tag down to a short, safe label; null if nothing usable is left. */
export function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const tag = raw.toLowerCase().replace(/[^a-z0-9 -]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH).trim();
  return tag.length >= 2 ? tag : null;
}

/** Appends new tags after the existing ones, dropping duplicates and respecting the per-asset cap. */
export function mergeTags(existing: string, incoming: string[]): string {
  const out = splitTags(existing);
  for (const raw of incoming) {
    const tag = normalizeTag(raw);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, MAX_TAGS_PER_ASSET).join(", ");
}

/** Pulls a tag list out of a model reply: `{"tags":[...]}`, a bare JSON array, or a comma-separated line. */
export function parseTagReply(content: string, max = 8): string[] {
  const candidates: unknown[] = [];
  const object = content.match(/\{[\s\S]*\}/);
  if (object) {
    try {
      const parsed = JSON.parse(object[0]);
      if (Array.isArray(parsed?.tags)) candidates.push(...parsed.tags);
    } catch { /* fall through */ }
  }
  if (candidates.length === 0) {
    const array = content.match(/\[[\s\S]*\]/);
    if (array) {
      try {
        const parsed = JSON.parse(array[0]);
        if (Array.isArray(parsed)) candidates.push(...parsed);
      } catch { /* fall through */ }
    }
  }
  if (candidates.length === 0) candidates.push(...content.split(/[,\n]/));
  const tags: string[] = [];
  for (const c of candidates) {
    const tag = normalizeTag(typeof c === "string" ? c.replace(/^[-*\d.)\s]+/, "") : c);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length >= max) break;
  }
  return tags;
}

export interface AssetMeta {
  id: number;
  filename: string;
  category: string;
  mimeType: string;
  tags: string;
}

const FILENAME_NOISE = new Set(["png", "jpg", "jpeg", "gif", "webp", "psd", "moho", "blend", "mp3", "wav", "final", "copy", "export", "image", "img"]);

function nameTokens(filename: string): Set<string> {
  return new Set(
    filename.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !FILENAME_NOISE.has(t)),
  );
}

const overlap = <T,>(a: Set<T>, b: Set<T>) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n; };

/** Higher is more alike. Tags dominate, then filename words, then category/type as tie-breakers. */
export function similarityScore(a: AssetMeta, b: AssetMeta): number {
  let score = overlap(new Set(splitTags(a.tags)), new Set(splitTags(b.tags))) * 3;
  score += overlap(nameTokens(a.filename), nameTokens(b.filename)) * 1.5;
  if (a.category && a.category === b.category) score += 1;
  if (a.mimeType.split("/")[0] === b.mimeType.split("/")[0]) score += 0.25;
  return score;
}

/** Category + file type alone isn't "similar", so require at least one shared tag or filename word. */
export const MIN_SIMILARITY = 1.5;

export function rankSimilar<T extends AssetMeta>(target: AssetMeta, candidates: T[], limit = 8): { asset: T; score: number }[] {
  return candidates
    .filter((c) => c.id !== target.id)
    .map((asset) => ({ asset, score: similarityScore(target, asset) }))
    .filter((r) => r.score >= MIN_SIMILARITY)
    .sort((x, y) => y.score - x.score || y.asset.id - x.asset.id)
    .slice(0, limit);
}
