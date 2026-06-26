/**
 * Clip generation service.
 *
 * Produces short-form cuts based on the real video duration and target platform.
 * When the real AI model lands, return the same `Clip[]` shape from your backend.
 */
import type { Clip, ClipTag, PlatformId, VideoMeta } from "@/types";
import { thumbnailForClip } from "@/services/youtube";

const ALL_TAGS: ClipTag[] = [
  "funny",
  "impactful",
  "emotional",
  "viral",
  "lesson",
  "question",
  "answer",
  "topic-shift",
  "retention",
];

const TITLE_FRAGMENTS = [
  "O momento que ninguém esperava",
  "Isso mudou tudo",
  "A pergunta perfeita",
  "Verdade incômoda sobre o mercado",
  "O conselho que vale ouro",
  "Quando a conversa virou",
  "A frase que viralizou",
  "Por que isso importa agora",
  "O erro que todo mundo comete",
  "A resposta que silenciou todos",
  "Um insight raro",
  "O gancho que prende em 3 segundos",
];

/** Min/max clip length per platform (seconds). */
const FORMAT_LIMITS: Record<PlatformId, { min: number; max: number }> = {
  shorts: { min: 15, max: 60 },
  reels: { min: 15, max: 90 },
  tiktok: { min: 15, max: 60 },
  twitter: { min: 20, max: 140 },
  facebook: { min: 30, max: 120 },
};

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickTags(rand: () => number): ClipTag[] {
  const count = 1 + Math.floor(rand() * 3);
  const pool = [...ALL_TAGS];
  const tags: ClipTag[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(rand() * pool.length);
    tags.push(pool.splice(idx, 1)[0]);
  }
  return tags;
}

export async function generateClips(
  video: VideoMeta,
  format: PlatformId,
): Promise<Clip[]> {
  await new Promise((r) => setTimeout(r, 600));

  const limits = FORMAT_LIMITS[format];
  const rand = mulberry32(
    video.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
  );

  if (video.duration < limits.min + 5) {
    return [];
  }

  // One clip roughly every 45–75s of source video, capped for usability.
  const spacing = 45 + rand() * 30;
  const estimated = Math.max(
    3,
    Math.min(18, Math.floor(video.duration / spacing)),
  );

  const clips: Clip[] = [];
  const segment = video.duration / estimated;

  for (let i = 0; i < estimated; i++) {
    const maxLength = Math.min(limits.max, video.duration - 2);
    if (maxLength < limits.min) break;

    const length =
      limits.min + Math.floor(rand() * (maxLength - limits.min + 1));

    const jitter = (rand() - 0.5) * segment * 0.35;
    const rawStart = Math.floor(i * segment + jitter);
    const start = Math.max(0, Math.min(rawStart, video.duration - length));
    const end = Math.min(video.duration, start + length);

    if (end - start < limits.min) continue;

    clips.push({
      id: `${video.id}-${i}`,
      title: TITLE_FRAGMENTS[i % TITLE_FRAGMENTS.length],
      start,
      end,
      duration: end - start,
      score: Math.min(0.99, 0.62 + rand() * 0.37),
      tags: pickTags(rand),
      thumbnail: thumbnailForClip(video.id, start, end, format),
      format,
    });
  }

  return clips.sort((a, b) => b.score - a.score);
}
