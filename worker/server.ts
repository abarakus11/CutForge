/**
 * Clip worker — deploy on Render/Railway/Fly (has ffmpeg + yt-dlp).
 * Set CLIP_WORKER_URL on Vercel to this service URL.
 */
import express from "express";
import { spawn } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const app = express();
const PORT = Number(process.env.PORT || 3001);

function ytDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    proc.stdout.on("data", (c) => (out += c));
    proc.stderr.on("data", (c) => (err += c));
    proc.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err || `yt-dlp exit ${code}`));
    });
  });
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/streams", async (req, res) => {
  const videoId = String(req.query.videoId || "");
  if (!/^[\w-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "videoId inválido" });
  }

  try {
    const json = await ytDlp([
      `https://www.youtube.com/watch?v=${videoId}`,
      "-J",
      "--no-playlist",
      "--extractor-args",
      "youtube:player_client=android,web",
    ]);
    const info = JSON.parse(json) as {
      formats?: Array<{ url?: string; vcodec?: string; acodec?: string; height?: number; ext?: string }>;
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
    console.error(err);
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
    await ytDlp([
      `https://www.youtube.com/watch?v=${videoId}`,
      "--download-sections",
      `*${start}-${end}`,
      "-f",
      "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
      "--merge-output-format",
      "mp4",
      "-o",
      out,
      "--no-playlist",
      "--force-keyframes-at-cuts",
    ]);

    const buffer = await readFile(out);
    res.setHeader("Content-Type", "video/mp4");
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "falha ao gerar corte" });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`clip-worker on :${PORT}`);
});
