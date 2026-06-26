import { readFile } from "fs/promises";
import { buildCropScaleFilter, type PlatformId } from "./platform";
import { runFfmpeg } from "./clip-render";

/** Frame a few seconds into the cut (avoids hard cuts at start). */
export function thumbnailTimestamp(start: number, end: number): number {
  const offset = Math.min(3, Math.floor((end - start) / 4));
  return Math.floor(start + Math.max(1, offset));
}

function thumbDimensions(format: PlatformId): { width: number; height: number } {
  const ratios: Record<PlatformId, { w: number; h: number }> = {
    shorts: { w: 9, h: 16 },
    reels: { w: 9, h: 16 },
    tiktok: { w: 9, h: 16 },
    twitter: { w: 1, h: 1 },
    facebook: { w: 16, h: 9 },
  };
  const { w, h } = ratios[format];
  const width = 360;
  const height = Math.round((width * h) / w);
  return { width, height };
}

/** Extract frame via ffmpeg seek on a remote/local stream URL. */
export async function extractThumbnailFromStream(
  streamUrl: string,
  at: number,
  format: PlatformId,
  outputPath: string,
): Promise<Buffer> {
  const { width, height } = thumbDimensions(format);
  const vf = buildCropScaleFilter(width, height);

  await runFfmpeg([
    "-y",
    "-ss",
    String(at),
    "-i",
    streamUrl,
    "-vframes",
    "1",
    "-vf",
    vf,
    "-q:v",
    "3",
    outputPath,
  ]);

  return readFile(outputPath);
}

/** Extract a cropped JPEG frame from a local video file. */
export async function extractThumbnailFrame(
  mediaPath: string,
  format: PlatformId,
  outputPath: string,
): Promise<Buffer> {
  const { width, height } = thumbDimensions(format);
  const vf = buildCropScaleFilter(width, height);

  await runFfmpeg([
    "-y",
    "-ss",
    "0.5",
    "-i",
    mediaPath,
    "-vframes",
    "1",
    "-vf",
    vf,
    "-q:v",
    "3",
    outputPath,
  ]);

  return readFile(outputPath);
}
