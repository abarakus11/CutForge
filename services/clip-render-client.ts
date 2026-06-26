import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import type { PlatformId } from "@/types";
import {
  buildCropScaleFilter,
  outputForQuality,
  type RenderQuality,
} from "@/lib/platform-output";
import { getYouTubeStreamUrls } from "@/lib/innertube-shared";
import { buildClipAssClient } from "@/services/captions-client";
import { parseHighlightColor } from "@/lib/captions-core";

export interface ClientRenderOptions {
  videoId: string;
  start: number;
  end: number;
  format: PlatformId;
  quality?: RenderQuality;
  captionLang?: string | null;
  highlightColor?: string | null;
  onProgress?: (pct: number, message: string) => void;
}

let ffmpegSingleton: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

function proxyStreamUrl(url: string): string {
  const path = `/api/stream-proxy?url=${encodeURIComponent(url)}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}

async function getFfmpeg(onProgress?: (pct: number, msg: string) => void): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => {
        const pct = Math.min(99, Math.round((progress || 0) * 100));
        onProgress?.(pct, "Processando vídeo…");
      });

      const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
      onProgress?.(2, "Carregando motor de vídeo…");
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      });

      ffmpegSingleton = ffmpeg;
      return ffmpeg;
    })();
  }

  return ffmpegLoadPromise;
}

function clampRange(
  start: number,
  end: number,
  maxDuration?: number,
): { start: number; end: number } {
  const safeStart = Math.max(0, Math.floor(start));
  let safeEnd = Math.max(safeStart + 1, Math.floor(end));
  if (maxDuration && maxDuration > 0) {
    safeEnd = Math.min(safeEnd, maxDuration);
  }
  return { start: safeStart, end: safeEnd };
}

/** Render a clip entirely in the browser (for Vercel / serverless). */
export async function renderClipClient(
  options: ClientRenderOptions,
): Promise<Blob> {
  const {
    videoId,
    start,
    end,
    format,
    quality = "full",
    captionLang,
    highlightColor,
    onProgress,
  } = options;

  const range = clampRange(start, end);
  const duration = range.end - range.start;
  if (duration < 3) {
    throw new Error("Corte muito curto para renderizar");
  }

  onProgress?.(5, "Obtendo stream do YouTube…");
  const streams = await getYouTubeStreamUrls(videoId);

  const { width, height } = outputForQuality(format, quality);
  const hl = parseHighlightColor(highlightColor ?? undefined);

  onProgress?.(12, "Carregando legendas…");
  const assContent = await buildClipAssClient(
    videoId,
    range.start,
    range.end,
    width,
    height,
    captionLang,
    hl,
  );

  const ffmpeg = await getFfmpeg(onProgress);

  onProgress?.(18, "Baixando trecho do vídeo…");

  const videoProxy = proxyStreamUrl(streams.videoUrl);
  const audioProxy = proxyStreamUrl(streams.audioUrl);

  let vf = buildCropScaleFilter(width, height);
  const outputName = "output.mp4";

  const args = [
    "-ss",
    String(range.start),
    "-i",
    videoProxy,
    "-ss",
    String(range.start),
    "-i",
    audioProxy,
    "-t",
    String(duration),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
  ];

  if (assContent) {
    await ffmpeg.writeFile("subs.ass", new TextEncoder().encode(assContent));
    vf += `,subtitles=subs.ass`;
  }

  args.push(
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    quality === "full" ? "22" : "26",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-shortest",
    outputName,
  );

  try {
    await ffmpeg.deleteFile(outputName).catch(() => {});
    await ffmpeg.deleteFile("subs.ass").catch(() => {});
  } catch {
    /* first run */
  }

  onProgress?.(25, "Renderizando corte…");

  try {
    await ffmpeg.exec(args);
  } catch (firstErr) {
    if (!assContent) throw firstErr;

    onProgress?.(30, "Legendas indisponíveis, renderizando sem legendas…");
    await ffmpeg.deleteFile("subs.ass").catch(() => {});
    const argsNoSubs = args.filter(
      (a, i, arr) =>
        !(a === "subtitles=subs.ass" || arr[i - 1] === "-vf" && a.includes("subtitles=")),
    );
    const vfIdx = argsNoSubs.indexOf("-vf");
    if (vfIdx >= 0) argsNoSubs[vfIdx + 1] = buildCropScaleFilter(width, height);
    await ffmpeg.exec(argsNoSubs);
  }

  onProgress?.(98, "Finalizando…");
  const data = await ffmpeg.readFile(outputName);
  const bytes =
    data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));

  onProgress?.(100, "Pronto!");
  return new Blob([new Uint8Array(bytes)], { type: "video/mp4" });
}

/** Warm ffmpeg.wasm in the background. */
export function prefetchFfmpegClient(): void {
  if (typeof window === "undefined") return;
  void getFfmpeg().catch(() => {});
}
