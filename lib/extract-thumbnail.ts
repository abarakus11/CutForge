import { spawn } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { PlatformId } from "@/types";
import { clipCacheKey, getCachedClip, setCachedClip } from "@/lib/clip-cache";
import {
  buildCropScaleFilter,
  PLATFORM_OUTPUT,
} from "@/lib/platform-output";
import { getCachedStreamUrl, getFfmpegPath } from "@/lib/ytdlp";

interface ThumbnailOptions {
  videoId: string;
  start: number;
  end: number;
  format: PlatformId;
}

/** Pick a frame a few seconds into the cut (avoids hard cuts). */
export function thumbnailTimestamp(start: number, end: number): number {
  const offset = Math.min(3, Math.floor((end - start) / 4));
  return Math.floor(start + Math.max(1, offset));
}

function thumbDimensions(format: PlatformId): { width: number; height: number } {
  const base = PLATFORM_OUTPUT[format];
  const width = 360;
  const height = Math.round((width * base.height) / base.width);
  return { width, height };
}

function runFfmpeg(args: string[]): Promise<void> {
  const ffmpeg = getFfmpegPath();

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg saiu com código ${code}`));
    });

    proc.on("error", reject);
  });
}

async function getStreamUrl(videoId: string): Promise<string> {
  return getCachedStreamUrl(videoId);
}

/** Extract a single JPEG frame cropped to the clip's platform format. */
export async function extractClipThumbnail({
  videoId,
  start,
  end,
  format,
}: ThumbnailOptions): Promise<Buffer> {
  const at = thumbnailTimestamp(start, end);
  const cacheKey = clipCacheKey(["thumb", "v1", videoId, String(at), format]);

  const cached = getCachedClip(cacheKey);
  if (cached) return cached;

  const streamUrl = await getStreamUrl(videoId);
  const { width, height } = thumbDimensions(format);
  const vf = buildCropScaleFilter(width, height);

  const dir = await mkdtemp(join(tmpdir(), "cutforge-thumb-"));
  const outputPath = join(dir, "frame.jpg");

  try {
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

    const buffer = await readFile(outputPath);
    setCachedClip(cacheKey, buffer);
    return buffer;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
