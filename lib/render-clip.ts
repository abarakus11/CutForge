import { spawn } from "child_process";
import { mkdtemp, readdir, readFile, rm, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { PlatformId } from "@/types";
import { clipCacheKey, getCachedClip, setCachedClip } from "@/lib/clip-cache";
import {
  buildCropScaleFilter,
  outputForQuality,
  type RenderQuality,
} from "@/lib/platform-output";
import { encodeSettingsForQuality } from "@/lib/video-quality";
import { parseHighlightColor, writeClipAssFile } from "@/lib/captions";
import { assFilterForPath } from "@/lib/ass-text";
import {
  getCachedStreamUrl,
  getFfmpegPath,
  watchUrl,
  YTDLP_BEST_FORMAT_ATTEMPTS,
  ytDlp,
} from "@/lib/ytdlp";

interface RenderClipOptions {
  videoId: string;
  start: number;
  end: number;
  format: PlatformId;
  quality?: RenderQuality;
  videoDuration?: number;
  captionLang?: string | null;
  highlightColor?: string | null;
  captionFont?: string | null;
}

/** Prefer up to 4K source from YouTube. */
const YTDLP_FORMAT_ATTEMPTS = YTDLP_BEST_FORMAT_ATTEMPTS;

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

async function findRawFile(dir: string): Promise<string | null> {
  const files = await readdir(dir);
  const match = files.find((f) => /^raw\.(mp4|mkv|webm)$/i.test(f));
  return match ? join(dir, match) : null;
}

async function clearRawFiles(dir: string) {
  const files = await readdir(dir);
  await Promise.all(
    files
      .filter((f) => f.startsWith("raw."))
      .map((f) => unlink(join(dir, f)).catch(() => {})),
  );
}

async function downloadSectionWithYtDlp(
  videoId: string,
  start: number,
  end: number,
  rawTemplate: string,
): Promise<void> {
  const url = watchUrl(videoId);
  const ffmpeg = getFfmpegPath();
  let lastError: Error | null = null;

  for (const format of YTDLP_FORMAT_ATTEMPTS) {
    await clearRawFiles(join(rawTemplate, ".."));

    try {
      await ytDlp(url, {
        output: rawTemplate,
        format,
        mergeOutputFormat: "mp4",
        downloadSections: `*${start}-${end}`,
        forceKeyframesAtCuts: true,
        ffmpegLocation: ffmpeg,
        noPlaylist: true,
        noWarnings: true,
      });

      const rawFile = await findRawFile(join(rawTemplate, ".."));
      if (rawFile) return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Falha ao extrair o trecho do YouTube");
}

async function downloadSectionWithFfmpeg(
  videoId: string,
  start: number,
  end: number,
  outputPath: string,
): Promise<void> {
  const streamUrl = await getCachedStreamUrl(videoId);
  const duration = end - start;

  try {
    await runFfmpeg([
      "-y",
      "-ss",
      String(start),
      "-i",
      streamUrl,
      "-t",
      String(duration),
      "-c",
      "copy",
      "-avoid_negative_ts",
      "make_zero",
      outputPath,
    ]);
    return;
  } catch {
    await runFfmpeg([
      "-y",
      "-ss",
      String(start),
      "-i",
      streamUrl,
      "-t",
      String(duration),
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  }
}

async function extractRawSegment(
  videoId: string,
  start: number,
  end: number,
  dir: string,
): Promise<string> {
  const rawPath = join(dir, "raw.mp4");
  const rawTemplate = join(dir, "raw.%(ext)s");

  try {
    await downloadSectionWithYtDlp(videoId, start, end, rawTemplate);
    const rawFile = await findRawFile(dir);
    if (rawFile) return rawFile;
  } catch (err) {
    console.warn("[render-clip] yt-dlp section failed, trying ffmpeg:", err);
  }

  await downloadSectionWithFfmpeg(videoId, start, end, rawPath);
  return rawPath;
}

async function reformatForPlatform(
  inputPath: string,
  outputPath: string,
  format: PlatformId,
  quality: RenderQuality,
  subtitlesPath?: string | null,
): Promise<void> {
  const { width, height } = outputForQuality(format, quality);
  let vf = buildCropScaleFilter(width, height);

  if (subtitlesPath) {
    vf += `,${assFilterForPath(subtitlesPath)}`;
  }

  const { preset, crf, audioBitrate } = encodeSettingsForQuality(quality);

  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    "5.1",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    preset,
    "-crf",
    crf,
    "-c:a",
    "aac",
    "-b:a",
    audioBitrate,
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function getVideoDuration(videoId: string): Promise<number> {
  const info = (await ytDlp(watchUrl(videoId), {
    dumpSingleJson: true,
  })) as { duration?: number };

  if (!info.duration || info.duration <= 0) {
    throw new Error("Duração do vídeo indisponível");
  }

  return info.duration;
}

export function clampClipRange(
  start: number,
  end: number,
  videoDuration: number,
): { start: number; end: number } {
  const safeStart = Math.max(0, Math.min(Math.floor(start), videoDuration - 1));
  const safeEnd = Math.max(
    safeStart + 1,
    Math.min(Math.floor(end), videoDuration),
  );
  return { start: safeStart, end: safeEnd };
}

export async function renderClipToBuffer({
  videoId,
  start,
  end,
  format,
  quality = "full",
  videoDuration: knownDuration,
  captionLang,
  highlightColor,
  captionFont,
}: RenderClipOptions): Promise<Buffer> {
  const hl = parseHighlightColor(highlightColor ?? undefined);
  const lang = captionLang || "auto";
  const font = captionFont || "arial-black";

  const cacheKey = clipCacheKey([
    "v13-utf8-subs",
    videoId,
    String(Math.floor(start)),
    String(Math.floor(end)),
    format,
    quality,
    lang,
    hl,
    font,
  ]);

  const cached = getCachedClip(cacheKey);
  if (cached) return cached;

  const videoDuration = knownDuration ?? (await getVideoDuration(videoId));
  const range = clampClipRange(start, end, videoDuration);

  if (range.end - range.start < 3) {
    throw new Error("Corte muito curto para renderizar");
  }

  const dir = await mkdtemp(join(tmpdir(), "cutforge-"));
  const formattedPath = join(dir, "formatted.mp4");

  try {
    const rawFile = await extractRawSegment(
      videoId,
      range.start,
      range.end,
      dir,
    );

    const { width, height } = outputForQuality(format, quality);
    const assPath = await writeClipAssFile(
      videoId,
      range.start,
      range.end,
      width,
      height,
      dir,
      captionLang,
      hl,
      font,
    );

    await reformatForPlatform(
      rawFile,
      formattedPath,
      format,
      quality,
      assPath,
    );

    const buffer = await readFile(formattedPath);
    setCachedClip(cacheKey, buffer);
    return buffer;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
