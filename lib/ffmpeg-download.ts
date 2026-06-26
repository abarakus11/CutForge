import { spawn } from "child_process";
import { fetchStreamsServer } from "@/lib/youtube-streams";
import type { StreamUrls } from "@/lib/stream-pick";
import { getFfmpegPath } from "@/lib/ytdlp";
import { isVercelRuntime } from "@/lib/youtube-meta";

const YT_HEADERS =
  "Referer: https://www.youtube.com/\r\nOrigin: https://www.youtube.com\r\nUser-Agent: Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36\r\n";

function streamUrlForFfmpeg(url: string): string {
  if (!isVercelRuntime()) return url;

  const host = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (!host) return url;

  const base = host.startsWith("http") ? host : `https://${host}`;
  return `${base}/api/stream-proxy?url=${encodeURIComponent(url)}`;
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

function sectionInputArgs(
  streams: StreamUrls,
  start: number,
  duration: number,
): string[] {
  const useProxy = isVercelRuntime();
  const videoUrl = useProxy ? streamUrlForFfmpeg(streams.videoUrl) : streams.videoUrl;
  const audioUrl = streams.audioUrl
    ? useProxy
      ? streamUrlForFfmpeg(streams.audioUrl)
      : streams.audioUrl
    : undefined;

  if (streams.combined || !audioUrl) {
    const args: string[] = ["-ss", String(start)];
    if (!useProxy) args.push("-headers", YT_HEADERS);
    args.push("-i", videoUrl, "-t", String(duration));
    return args;
  }

  const videoInput: string[] = ["-ss", String(start)];
  const audioInput: string[] = ["-ss", String(start)];
  if (!useProxy) {
    videoInput.push("-headers", YT_HEADERS);
    audioInput.push("-headers", YT_HEADERS);
  }
  videoInput.push("-i", videoUrl);
  audioInput.push("-i", audioUrl);

  return [
    ...videoInput,
    ...audioInput,
    "-t",
    String(duration),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-shortest",
  ];
}

/** Download a YouTube clip section using Innertube stream URLs (works on Vercel). */
export async function downloadClipSectionWithStreams(
  videoId: string,
  start: number,
  end: number,
  outputPath: string,
  streams?: StreamUrls | null,
): Promise<void> {
  const resolved = streams ?? (await fetchStreamsServer(videoId));
  if (!resolved?.videoUrl) {
    throw new Error("URL de stream indisponível");
  }

  const duration = end - start;
  const base = [
    "-y",
    "-hide_banner",
    ...sectionInputArgs(resolved, start, duration),
  ];

  try {
    await runFfmpeg([
      ...base,
      "-c",
      "copy",
      "-avoid_negative_ts",
      "make_zero",
      outputPath,
    ]);
    return;
  } catch {
    await runFfmpeg([
      ...base,
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
