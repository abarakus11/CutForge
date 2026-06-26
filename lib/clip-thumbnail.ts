import type { PlatformId } from "@/types";

/** Frame a few seconds into the cut (avoids hard cuts at start). */
export function thumbnailTimestamp(start: number, end: number): number {
  const offset = Math.min(3, Math.floor((end - start) / 4));
  return Math.floor(start + Math.max(1, offset));
}

/** Public worker base URL (browser + server). */
export function getPublicClipWorkerUrl(): string | null {
  const fromEnv =
    (typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_CLIP_WORKER_URL
      : process.env.CLIP_WORKER_URL || process.env.NEXT_PUBLIC_CLIP_WORKER_URL) ||
    "";

  const base = fromEnv.replace(/\/$/, "");
  return base || null;
}

function thumbnailParams(
  videoId: string,
  start: number,
  end: number,
  format: PlatformId,
): URLSearchParams {
  const at = thumbnailTimestamp(start, end);
  return new URLSearchParams({
    videoId,
    start: String(Math.floor(start)),
    end: String(Math.floor(end)),
    format,
    at: String(at),
  });
}

/** URL da API Next (proxy + storyboard fallback). */
export function clipThumbnailApiUrl(
  videoId: string,
  start: number,
  end: number,
  format: PlatformId,
): string {
  return `/api/clips/thumbnail?${thumbnailParams(videoId, start, end, format)}`;
}

/** Thumbnail URL for a clip moment — prefers worker (frame real do corte). */
export function clipThumbnailUrl(
  videoId: string,
  start: number,
  end: number,
  format: PlatformId,
  preferApi = false,
): string {
  const params = thumbnailParams(videoId, start, end, format);
  const worker = getPublicClipWorkerUrl();

  if (!preferApi && worker) {
    return `${worker}/thumbnail?${params}`;
  }

  return `/api/clips/thumbnail?${params}`;
}
