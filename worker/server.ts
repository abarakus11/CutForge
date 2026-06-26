/**
 * Clip worker — usa yt-dlp do projeto principal.
 * Deploy: Render (render.yaml) ou local + tunnel.
 */
import express from "express";
import { create as createYtDlp } from "youtube-dl-exec";
import { accessSync } from "fs";
import { mkdtemp, readFile, rm } from "fs/promises";
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

app.get("/clip", async (req, res) => {
  const videoId = String(req.query.videoId || "");
  const start = Number(req.query.start);
  const end = Number(req.query.end);
  if (!/^[\w-]{11}$/.test(videoId) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return res.status(400).json({ error: "parâmetros inválidos" });
  }

  const dir = await mkdtemp(join(tmpdir(), "clip-"));
  const out = join(dir, "clip.mp4");

  try {
    await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
      ...YT_FLAGS,
      downloadSections: `*${Math.floor(start)}-${Math.floor(end)}`,
      format:
        "bestvideo[height<=1080][vcodec^=avc1]+bestaudio/best[height<=1080]/best",
      mergeOutputFormat: "mp4",
      output: out,
      forceKeyframesAtCuts: true,
    });

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
