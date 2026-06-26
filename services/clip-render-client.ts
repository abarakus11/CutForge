import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { PlatformId } from "@/types";
import {
  buildCropScaleFilter,
  outputForQuality,
  type RenderQuality,
} from "@/lib/platform-output";
import { getYouTubeStreamUrls } from "@/services/youtube-stream-client";
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
  captionFont?: string | null;
  onProgress?: (pct: number, message: string) => void;
}

let ffmpegSingleton: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;
let lastFfmpegError = "";

function proxyStreamUrl(url: string): string {
  const path = `/api/stream-proxy?url=${encodeURIComponent(url)}`;
  return `${window.location.origin}${path}`;
}

async function loadFfmpegModule(): Promise<typeof import("@ffmpeg/ffmpeg")> {
  return import("@ffmpeg/ffmpeg");
}

async function getFfmpeg(
  onProgress?: (pct: number, msg: string) => void,
): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const { FFmpeg } = await loadFfmpegModule();
      const { toBlobURL } = await import("@ffmpeg/util");

      const ffmpeg = new FFmpeg();
      lastFfmpegError = "";

      ffmpeg.on("log", ({ message }) => {
        if (message.toLowerCase().includes("error")) {
          lastFfmpegError = message.slice(0, 240);
        }
      });

      ffmpeg.on("progress", ({ progress }) => {
        const pct = Math.min(99, Math.round(25 + (progress || 0) * 70));
        onProgress?.(pct, "Processando vídeo…");
      });

      const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
      onProgress?.(3, "Carregando motor de vídeo…");

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
): { start: number; end: number } {
  const safeStart = Math.max(0, Math.floor(start));
  const safeEnd = Math.max(safeStart + 1, Math.floor(end));
  return { start: safeStart, end: safeEnd };
}

function buildFfmpegArgs(
  range: { start: number; end: number },
  streams: { videoUrl: string; audioUrl?: string; combined: boolean },
  vf: string,
  quality: RenderQuality,
  outputName: string,
): string[] {
  const duration = range.end - range.start;
  const videoProxy = proxyStreamUrl(streams.videoUrl);
  const headers =
    "Referer: https://www.youtube.com/\\r\\nOrigin: https://www.youtube.com\\r\\n";

  const base: string[] = [
    "-protocol_whitelist",
    "file,http,https,tcp,tls,crypto",
    "-hide_banner",
    "-y",
  ];

  if (streams.combined || !streams.audioUrl) {
    return [
      ...base,
      "-ss",
      String(range.start),
      "-headers",
      headers,
      "-i",
      videoProxy,
      "-t",
      String(duration),
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
      outputName,
    ];
  }

  const audioProxy = proxyStreamUrl(streams.audioUrl);
  return [
    ...base,
    "-ss",
    String(range.start),
    "-headers",
    headers,
    "-i",
    videoProxy,
    "-ss",
    String(range.start),
    "-headers",
    headers,
    "-i",
    audioProxy,
    "-t",
    String(duration),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
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
  ];
}

async function runFfmpeg(
  ffmpeg: FFmpeg,
  args: string[],
): Promise<void> {
  lastFfmpegError = "";
  const code = await ffmpeg.exec(args);
  if (code !== 0) {
    throw new Error(
      lastFfmpegError || `ffmpeg saiu com código ${code ?? "desconhecido"}`,
    );
  }
}

function startProgressTicker(
  onProgress: ((pct: number, msg: string) => void) | undefined,
  from: number,
  to: number,
  message: string,
): () => void {
  let pct = from;
  onProgress?.(pct, message);
  const id = setInterval(() => {
    pct = Math.min(to, pct + 2);
    onProgress?.(pct, message);
  }, 2500);
  return () => clearInterval(id);
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
    captionFont,
    onProgress,
  } = options;

  const range = clampRange(start, end);
  const duration = range.end - range.start;
  if (duration < 3) {
    throw new Error("Corte muito curto para renderizar");
  }

  onProgress?.(5, "Gerando corte…");

  const serverParams = new URLSearchParams({
    videoId,
    start: String(range.start),
    end: String(range.end),
    format,
    quality,
  });
  if (captionLang) serverParams.set("captionLang", captionLang);
  if (highlightColor) serverParams.set("highlightColor", highlightColor);
  if (captionFont) serverParams.set("captionFont", captionFont);

  try {
    onProgress?.(8, "Processando no servidor…");
    const stopTicker = startProgressTicker(
      onProgress,
      10,
      88,
      "Gerando corte com legendas…",
    );
    try {
      const serverRes = await fetch(`/api/clips/render?${serverParams}`, {
        signal: AbortSignal.timeout(300000),
      });
      if (serverRes.ok) {
        onProgress?.(100, "Pronto!");
        return serverRes.blob();
      }
    } finally {
      stopTicker();
    }
  } catch {
    // fallback para render no navegador
  }

  onProgress?.(10, "Obtendo stream do YouTube…");
  const streams = await getYouTubeStreamUrls(videoId).catch((err) => {
    throw new Error(
      err instanceof Error ? err.message : "Não foi possível obter o stream do vídeo",
    );
  });

  const { width, height } = outputForQuality(format, quality);
  const hl = parseHighlightColor(highlightColor ?? undefined);
  const outputName = "output.mp4";

  onProgress?.(10, "Transcrevendo fala do corte…");
  let assContent: string | null = null;
  try {
    assContent = await buildClipAssClient(
      videoId,
      range.start,
      range.end,
      width,
      height,
      captionLang,
      hl,
      captionFont,
    );
  } catch {
    assContent = null;
  }

  const ffmpeg = await getFfmpeg(onProgress);
  onProgress?.(18, "Renderizando corte…");

  let vf = buildCropScaleFilter(width, height);
  if (assContent) {
    await ffmpeg.writeFile("subs.ass", new TextEncoder().encode(assContent));
    vf += ",subtitles=subs.ass";
  }

  await ffmpeg.deleteFile(outputName).catch(() => {});
  await ffmpeg.deleteFile("subs.ass").catch(() => {});

  const args = buildFfmpegArgs(range, streams, vf, quality, outputName);

  try {
    await runFfmpeg(ffmpeg, args);
  } catch (firstErr) {
    if (!assContent) throw firstErr;

    onProgress?.(28, "Sem legendas, tentando novamente…");
    await ffmpeg.deleteFile("subs.ass").catch(() => {});
    const argsNoSubs = buildFfmpegArgs(
      range,
      streams,
      buildCropScaleFilter(width, height),
      quality,
      outputName,
    );
    await runFfmpeg(ffmpeg, argsNoSubs);
  }

  onProgress?.(98, "Finalizando…");
  const data = await ffmpeg.readFile(outputName);
  const bytes =
    data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));

  if (!bytes.byteLength) {
    throw new Error("O vídeo renderizado ficou vazio. Tente um corte menor.");
  }

  onProgress?.(100, "Pronto!");
  return new Blob([new Uint8Array(bytes)], { type: "video/mp4" });
}

/** Warm ffmpeg.wasm in the background. */
export function prefetchFfmpegClient(): void {
  if (typeof window === "undefined") return;
  void getFfmpeg().catch(() => {});
}

/** YouTube embed URL for instant preview while MP4 renders. */
export function youtubeEmbedPreviewUrl(
  videoId: string,
  start: number,
  end: number,
): string {
  const params = new URLSearchParams({
    start: String(Math.floor(start)),
    end: String(Math.floor(end)),
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  return `https://www.youtube.com/embed/${videoId}?${params}`;
}
