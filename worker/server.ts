/**
 * Clip worker — usa yt-dlp do projeto principal.
 * Deploy: Render (render.yaml) ou local + tunnel.
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
  parsePlatformFormat,
  parseRenderQuality,
  outputForQuality,
} from "./platform";
import {
  buildWorkerClipAssText,
  listWorkerCaptionLanguages,
} from "./captions";
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

const YT_FLAGS = {
  noPlaylist: true,
  noWarnings: true,
  extractorArgs: "youtube:player_client=android,web",
} as const;

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/streams", async (req, res) => {
  const videoId = String(req.query.videoId || "");
  if (!/^[\w-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "videoId inválido" });
  }

  try {
    const info = (await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
      ...YT_FLAGS,
      dumpSingleJson: true,
    })) as {
      formats?: Array<{
        url?: string;
        vcodec?: string;
        acodec?: string;
        height?: number;
        ext?: string;
      }>;
    };

    const formats = (info.formats || []).filter((f) => f.url);
    const muxed = formats
      .filter((f) => f.vcodec !== "none" && f.acodec !== "none" && f.ext === "mp4")
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

    if (muxed?.url) {
      return res.json({
        videoUrl: muxed.url,
        height: muxed.height || 720,
        combined: true,
      });
    }

    const video = formats
      .filter((f) => f.vcodec !== "none" && f.acodec === "none")
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
    const audio = formats.find((f) => f.acodec !== "none" && f.vcodec === "none");

    if (!video?.url || !audio?.url) {
      return res.status(502).json({ error: "streams indisponíveis" });
    }

    return res.json({
      videoUrl: video.url,
      audioUrl: audio.url,
      height: video.height || 1080,
      combined: false,
    });
  } catch (err) {
    console.error("[worker/streams]", err);
    return res.status(500).json({ error: "falha ao obter streams" });
  }
});

app.get("/captions/languages", async (req, res) => {
  const videoId = String(req.query.videoId || "");
  if (!/^[\w-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "videoId inválido" });
  }

  try {
    const tracks = await listWorkerCaptionLanguages(ytDlp, videoId, YT_FLAGS);
    return res.json({ tracks });
  } catch (err) {
    console.error("[worker/captions/languages]", err);
    return res.status(500).json({ error: "falha ao listar legendas" });
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

  if (!/^[\w-]{11}$/.test(videoId) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return res.status(400).json({ error: "parâmetros inválidos" });
  }
  if (!width || !height) {
    return res.status(400).json({ error: "width/height obrigatórios" });
  }

  const dir = await mkdtemp(join(tmpdir(), "ass-"));
  try {
    const ass = await buildWorkerClipAssText(
      ytDlp,
      videoId,
      start,
      end,
      width,
      height,
      dir,
      YT_FLAGS,
      captionLang,
      highlightColor,
    );
    if (!ass || !ass.includes("Dialogue:")) {
      return res.status(404).json({ error: "legendas indisponíveis" });
    }
    res.type("text/plain; charset=utf-8").send(ass);
  } catch (err) {
    console.error("[worker/captions/ass]", err);
    res.status(500).json({ error: "falha ao gerar legendas" });
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
  if (!/^[\w-]{11}$/.test(videoId) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return res.status(400).json({ error: "parâmetros inválidos" });
  }

  const dir = await mkdtemp(join(tmpdir(), "clip-"));
  const raw = rawClipPath(dir);
  const out = formattedClipPath(dir);

  try {
    await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
      ...YT_FLAGS,
      downloadSections: `*${Math.floor(start)}-${Math.floor(end)}`,
      format:
        "bestvideo[height<=1080][vcodec^=avc1]+bestaudio/best[height<=1080]/best",
      mergeOutputFormat: "mp4",
      output: raw,
      forceKeyframesAtCuts: true,
    });

    const { width, height } = outputForQuality(format, quality);
    const assPath = await writeWorkerClipAss(
      ytDlp,
      videoId,
      start,
      end,
      width,
      height,
      dir,
      YT_FLAGS,
      captionLang,
      highlightColor,
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
