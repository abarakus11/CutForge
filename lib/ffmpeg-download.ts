import { spawn } from "child_process";
import { fetchStreamsServer } from "@/lib/youtube-streams";
import type { StreamUrls } from "@/lib/stream-pick";
import { getFfmpegPath } from "@/lib/ytdlp";
import { isVercelRuntime } from "@/lib/youtube-meta";

const YT_HEADERS =
  "Referer: https://www.youtube.com/\r\nOrigin: https://www.youtube.com\r\nUser-Agent: Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36\r\n";

function productionBaseUrl(): string {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "");
  if (prod) return prod.startsWith("http") ? prod : `https://${prod}`;

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;

  return "https://cut-forge.vercel.app";
}

function streamUrlForFfmpeg(url: string): string {
  if (!isVercelRuntime()) return url;
  return `${productionBaseUrl()}/api/stream-proxy?url=${encodeURIComponent(url)}`;
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

function directInputArgs(
  streams: StreamUrls,
  start: number,
  duration: number,
): string[] {
  const videoUrl = streams.videoUrl;
  const audioUrl = streams.audioUrl;

  if (streams.combined || !audioUrl) {
    return [
      "-ss",
      String(start),
      "-headers",
      YT_HEADERS,
      "-i",
      videoUrl,
      "-t",
      String(duration),
    ];
  }

  return [
    "-ss",
    String(start),
    "-headers",
    YT_HEADERS,
    "-i",
    videoUrl,
    "-ss",
    String(start),
    "-headers",
    YT_HEADERS,
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

/** Seek after open — works with our stream-proxy on Vercel (avoids 403 on googlevideo). */
function proxiedInputArgs(
  streams: StreamUrls,
  start: number,
  duration: number,
): string[] {
  const videoUrl = streamUrlForFfmpeg(streams.videoUrl);
  const audioUrl = streams.audioUrl
    ? streamUrlForFfmpeg(streams.audioUrl)
    : undefined;

  if (streams.combined || !audioUrl) {
    return [
      "-i",
      videoUrl,
      "-ss",
      String(start),
      "-t",
      String(duration),
    ];
  }

  return [
    "-i",
    videoUrl,
    "-i",
    audioUrl,
    "-ss",
    String(start),
    "-t",
    String(duration),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-shortest",
  ];
}

async function runSectionExtract(
  inputArgs: string[],
  outputPath: string,
): Promise<void> {
  const base = ["-y", "-hide_banner", ...inputArgs];

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
  const strategies = isVercelRuntime()
    ? [
        () => runSectionExtract(proxiedInputArgs(resolved, start, duration), outputPath),
        () => runSectionExtract(directInputArgs(resolved, start, duration), outputPath),
      ]
    : [
        () => runSectionExtract(directInputArgs(resolved, start, duration), outputPath),
        () => runSectionExtract(proxiedInputArgs(resolved, start, duration), outputPath),
      ];

  let lastError: Error | null = null;
  for (const strategy of strategies) {
    try {
      await strategy();
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn("[ffmpeg-download] strategy failed:", lastError.message.slice(0, 200));
    }
  }

  throw lastError ?? new Error("Falha ao extrair trecho via streams");
}
