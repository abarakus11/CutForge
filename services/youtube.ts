/**
 * YouTube service layer.
 */
import type { CaptionSettings, PlatformId, VideoMeta } from "@/types";

const YT_PATTERNS: RegExp[] = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/i,
  /(?:youtu\.be\/)([\w-]{11})/i,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/i,
  /(?:youtube\.com\/embed\/)([\w-]{11})/i,
  /(?:youtube\.com\/live\/)([\w-]{11})/i,
  /(?:music\.youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/i,
  /(?:m\.youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/i,
];

/** Strip invisible chars and whitespace that break pasted URLs. */
function normalizeYouTubeInput(input: string): string {
  return input
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "");
}

/** Returns the 11-char video id, or null if the URL isn't a YouTube link. */
export function parseYouTubeId(input: string): string | null {
  const url = normalizeYouTubeInput(input);
  if (!url) return null;

  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  if (/^[\w-]{11}$/.test(url)) return url;

  return null;
}

export function validateYouTubeUrl(input: string): boolean {
  return parseYouTubeId(input) !== null;
}

export function thumbnailFor(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Thumbnail URL for a specific clip moment (server-rendered frame). */
export function thumbnailForClip(
  videoId: string,
  start: number,
  end: number,
  format: PlatformId,
): string {
  const params = new URLSearchParams({
    videoId,
    start: String(Math.floor(start)),
    end: String(Math.floor(end)),
    format,
  });
  return `/api/clips/thumbnail?${params}`;
}

/** Preview URL for a rendered clip segment (MP4). */
export function previewUrlForClip(
  videoId: string,
  start: number,
  end: number,
  format: PlatformId,
  videoDuration?: number,
  captions?: CaptionSettings,
): string {
  const params = new URLSearchParams({
    videoId,
    start: String(Math.floor(start)),
    end: String(Math.floor(end)),
    format,
    quality: "full",
    captionLang: captions?.language || "auto",
    highlightColor: captions?.highlightColor || "#FFFF00",
  });
  if (videoDuration && videoDuration > 0) {
    params.set("duration", String(Math.floor(videoDuration)));
  }
  return `/api/clips/preview?${params}`;
}

/** Warm the server cache so preview/download open faster. */
export function prefetchClipPreview(
  videoId: string,
  start: number,
  end: number,
  format: PlatformId,
  videoDuration?: number,
  captions?: CaptionSettings,
): void {
  if (typeof window === "undefined") return;
  const url = previewUrlForClip(
    videoId,
    start,
    end,
    format,
    videoDuration,
    captions,
  );
  fetch(url).catch(() => {});
}

/** Fetch real metadata from the YouTube source via the server. */
export async function fetchVideoMeta(input: string): Promise<VideoMeta> {
  const trimmed = normalizeYouTubeInput(input);
  const videoId = parseYouTubeId(trimmed);
  if (!videoId) {
    throw new Error(
      "Não reconhecemos esse link. Cole um endereço válido do YouTube.",
    );
  }

  const res = await fetch(
    `/api/youtube/meta?videoId=${encodeURIComponent(videoId)}`,
  );

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Link do YouTube inválido");
  }

  return res.json() as Promise<VideoMeta>;
}
