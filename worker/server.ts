/**
 * Clip worker — yt-dlp + ffmpeg + Whisper (legendas próprias).
 */
import express from "express";
import { create as createYtDlp } from "youtube-dl-exec";
import { accessSync } from "fs";
import { mkdtemp, readFile, rm } from "fs/promises";
import {
  formatClipForPlatform,
  formattedClipPath,
  rawClipPath,
} from "./clip-render";
import {
  extractThumbnailFromStream,
  thumbnailTimestamp,
} from "./thumbnail";
import { resolveBestStreams, resolveVideoStreamUrl } from "./streams";
import { YTDLP_CLIP_FORMAT_ATTEMPTS } from "../lib/video-quality";
import {
  parsePlatformFormat,
  parseRenderQuality,
  outputForQuality,
} from "./platform";
import {
  buildWorkerClipAssTextFromMedia,
  TRANSCRIPTION_LANGUAGES,
  writeWorkerClipAssFromMedia,
} from "./captions";
import { transcribeMediaFile } from "./transcribe";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function resolveYtDlpBin(): string {
  if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH;

  const candidates = [
    join(
      rootDir,
      "node_modules",
      "youtube-dl-exec",
      "bin",
      process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
    ),
    join(
      __dirname,
      "node_modules",
      "youtube-dl-exec",
      "bin",
      process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
    ),
    "yt-dlp",
  ];

  for (const candidate of candidates) {
    if (candidate === "yt-dlp") return candidate;
    try {
      accessSync(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return "yt-dlp";
}

const ytDlp = createYtDlp(resolveYtDlpBin());
const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.options("*", (_req, res) => res.sendStatus(204));

const YT_FLAGS = {
  noPlaylist: true,
  noWarnings: true,
  extractorArgs: "youtube:player_client=android,web",
} as const;

async function downloadClipSection(
  videoId: string,
  start: number,
  end: number,
  outputPath: string,
): Promise<void> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const section = `*${Math.floor(start)}-${Math.floor(end)}`;
  let lastError: Error | null = null;

  for (const format of YTDLP_CLIP_FORMAT_ATTEMPTS) {
    try {
      await ytDlp(url, {
        ...YT_FLAGS,
        downloadSections: section,
        format,
        mergeOutputFormat: "mp4",
        output: outputPath,
        forceKeyframesAtCuts: true,
      });
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("falha ao baixar trecho em alta qualidade");
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/streams", async (req, res) => {
  const videoId = String(req.query.videoId || "");
  if (!/^[\w-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "videoId inválido" });
  }

  try {
    const streams = await resolveBestStreams(ytDlp, videoId);
    return res.json(streams);
  } catch (err) {
    console.error("[worker/streams]", err);
    return res.status(500).json({ error: "falha ao obter streams" });
  }
});

app.get("/captions/languages", (_req, res) => {
  res.json({
    tracks: TRANSCRIPTION_LANGUAGES.map((t) => ({
      lang: t.lang,
      label: t.label,
      auto: t.lang === "auto",
    })),
  });
});

app.get("/transcribe", async (req, res) => {
  const videoId = String(req.query.videoId || "");
  const start = Number(req.query.start);
  const end = Number(req.query.end);
  const captionLang = String(req.query.captionLang || "auto");

  if (!/^[\w-]{11}$/.test(videoId) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return res.status(400).json({ error: "parâmetros inválidos" });
  }

  const dir = await mkdtemp(join(tmpdir(), "transcribe-"));
  const raw = rawClipPath(dir);

  try {
    await downloadClipSection(videoId, start, end, raw);
    const result = await transcribeMediaFile(raw, dir, captionLang);
    res.json({
      language: result.language,
      words: result.words,
      cues: result.cues,
    });
  } catch (err) {
    console.error("[worker/transcribe]", err);
    res.status(500).json({ error: "falha na transcrição" });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

app.get("/captions/ass", async (req, res) => {
  const videoId = String(req.query.videoId || "");
  const start = Number(req.query.start);
  const end = Number(req.query.end);
  const width = Number(req.query.width);
  const height = Number(req.query.height);
  const captionLang = String(req.query.captionLang || "auto");
  const highlightColor = String(req.query.highlightColor || "#FFFF00");
  const captionFont = String(req.query.captionFont || "arial-black");

  if (!/^[\w-]{11}$/.test(videoId) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return res.status(400).json({ error: "parâmetros inválidos" });
  }

  const dims =
    width > 0 && height > 0
      ? { width, height }
      : { width: 720, height: 1280 };

  const dir = await mkdtemp(join(tmpdir(), "ass-"));
  const raw = rawClipPath(dir);
  const duration = end - start;

  try {
    await downloadClipSection(videoId, start, end, raw);
    const ass = await buildWorkerClipAssTextFromMedia(
      raw,
      duration,
      dims.width,
      dims.height,
      dir,
      captionLang,
      highlightColor,
      captionFont,
    );
    if (!ass || !ass.includes("Dialogue:")) {
      return res.status(404).json({ error: "nenhuma fala detectada no trecho" });
    }
    res.type("text/plain; charset=utf-8").send(ass);
  } catch (err) {
    console.error("[worker/captions/ass]", err);
    res.status(500).json({ error: "falha ao gerar legendas" });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

app.get("/thumbnail", async (req, res) => {
  const videoId = String(req.query.videoId || "");
  const start = Number(req.query.start);
  const end = Number(req.query.end);
  const format = parsePlatformFormat(String(req.query.format || ""));

  if (!/^[\w-]{11}$/.test(videoId) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return res.status(400).json({ error: "parâmetros inválidos" });
  }

  const at = thumbnailTimestamp(start, end);
  const dir = await mkdtemp(join(tmpdir(), "thumb-"));
  const frame = join(dir, "frame.jpg");

  try {
    const streamUrl = await resolveVideoStreamUrl(ytDlp, videoId);
    const buffer = await extractThumbnailFromStream(
      streamUrl,
      at,
      format,
      frame,
    );
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.send(buffer);
  } catch (err) {
    console.error("[worker/thumbnail]", err);
    res.status(500).json({ error: "falha ao gerar thumbnail" });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

app.get("/clip", async (req, res) => {
  const videoId = String(req.query.videoId || "");
  const start = Number(req.query.start);
  const end = Number(req.query.end);
  const format = parsePlatformFormat(String(req.query.format || ""));
  const quality = parseRenderQuality(String(req.query.quality || ""));
  const captionLang = String(req.query.captionLang || "auto");
  const highlightColor = String(req.query.highlightColor || "#FFFF00");
  const captionFont = String(req.query.captionFont || "arial-black");
  if (!/^[\w-]{11}$/.test(videoId) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return res.status(400).json({ error: "parâmetros inválidos" });
  }

  const dir = await mkdtemp(join(tmpdir(), "clip-"));
  const raw = rawClipPath(dir);
  const out = formattedClipPath(dir);
  const duration = end - start;

  try {
    await downloadClipSection(videoId, start, end, raw);

    const { width, height } = outputForQuality(format, quality);
    const assPath = await writeWorkerClipAssFromMedia(
      raw,
      duration,
      width,
      height,
      dir,
      captionLang,
      highlightColor,
      captionFont,
    );

    await formatClipForPlatform(raw, out, format, quality, assPath);

    const buffer = await readFile(out);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "attachment; filename=clip.mp4");
    res.send(buffer);
  } catch (err) {
    console.error("[worker/clip]", err);
    res.status(500).json({ error: "falha ao gerar corte" });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`[clip-worker] http://localhost:${PORT}`);
});
