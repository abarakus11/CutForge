import { spawn } from "child_process";
import { fetchStreamsServer } from "@/lib/youtube-streams";
import type { StreamUrls } from "@/lib/stream-pick";
import { getFfmpegPath } from "@/lib/ytdlp";
import { isVercelRuntime } from "@/lib/youtube-meta";

const YT_HEADERS =
  "Referer: https://www.youtube.com/\\r\\nOrigin: https://www.youtube.com\\r\\n";

function streamProxyUrl(directUrl: string): string {
  const host = process.env.VERCEL_URL;
  if (!host) return directUrl;

  const origin = host.startsWith("http") ? host : `https://${host}`;
  return `${origin}/api/stream-proxy?url=${encodeURIComponent(directUrl)}`;
}

function inputUrl(url: string, viaProxy: boolean): string {
  return viaProxy ? streamProxyUrl(url) : url;
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
  viaProxy: boolean,
): string[] {
  const videoUrl = inputUrl(streams.videoUrl, viaProxy);
  const audioUrl = streams.audioUrl
    ? inputUrl(streams.audioUrl, viaProxy)
    : undefined;
  const headerArgs = viaProxy ? [] : ["-headers", YT_HEADERS];

  if (streams.combined || !audioUrl) {
    return [
      "-ss",
      String(start),
      ...headerArgs,
      "-i",
      videoUrl,
      "-t",
      String(duration),
    ];
  }

  return [
    "-ss",
    String(start),
    ...headerArgs,
    "-i",
    videoUrl,
    "-ss",
    String(start),
    ...headerArgs,
    "-i",
    audioUrl,
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

  const viaProxy = isVercelRuntime();
  const duration = end - start;
  const base = [
    "-y",
    "-hide_banner",
    ...sectionInputArgs(resolved, start, duration, viaProxy),
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
