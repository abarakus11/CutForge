import { spawn } from "child_process";
import { accessSync } from "fs";
import { join } from "path";
import {
  buildCropScaleFilter,
  outputForQuality,
  type PlatformId,
  type RenderQuality,
} from "./platform";

function ffmpegBin(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const local = join(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );
  try {
    accessSync(local);
    return local;
  } catch {
    return "ffmpeg";
  }
}

export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exit ${code}`));
    });
    proc.on("error", reject);
  });
}

/** Crop + scale raw segment to the selected social format (optional ASS burn-in). */
export async function formatClipForPlatform(
  inputPath: string,
  outputPath: string,
  format: PlatformId,
  quality: RenderQuality,
  subtitlesPath?: string | null,
): Promise<void> {
  const { width, height } = outputForQuality(format, quality);
  let vf = buildCropScaleFilter(width, height);

  if (subtitlesPath) {
    const escaped = subtitlesPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    vf += `,subtitles='${escaped}'`;
  }

  const preset = quality === "full" ? "fast" : "ultrafast";
  const crf = quality === "full" ? "20" : "23";

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
    "-pix_fmt",
    "yuv420p",
    "-preset",
    preset,
    "-crf",
    crf,
    "-c:a",
    "aac",
    "-b:a",
    quality === "full" ? "256k" : "192k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export function rawClipPath(dir: string): string {
  return join(dir, "raw.mp4");
}

export function formattedClipPath(dir: string): string {
  return join(dir, "clip.mp4");
}
