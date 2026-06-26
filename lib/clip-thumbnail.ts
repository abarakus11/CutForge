import type { PlatformId } from "@/types";

/** Frame a few seconds into the cut (avoids hard cuts at start). */
export function thumbnailTimestamp(start: number, end: number): number {
  const offset = Math.min(3, Math.floor((end - start) / 4));
  return Math.floor(start + Math.max(1, offset));
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

/** Thumbnail via API Vercel (proxy → worker na nuvem). */
export function clipThumbnailUrl(
  videoId: string,
  start: number,
  end: number,
  format: PlatformId,
): string {
  return `/api/clips/thumbnail?${thumbnailParams(videoId, start, end, format)}`;
}
