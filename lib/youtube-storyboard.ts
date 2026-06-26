import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getFfmpegPath } from "@/lib/ytdlp";
import { fetchPlayerResponse } from "@/lib/youtube-meta";

interface StoryboardBoard {
  level: number;
  templateUrl: string;
  thumbWidth: number;
  thumbHeight: number;
  thumbCount: number;
  columns: number;
  rows: number;
  intervalMs: number;
  sheetCount: number;
}

interface StoryboardFrame {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function parseStoryboardSpec(spec: string): StoryboardBoard[] {
  const parts = spec.split("|");
  if (parts.length < 2) return [];

  const baseUrl = new URL(parts[0]);
  const boards: StoryboardBoard[] = [];

  for (let i = 1; i < parts.length; i++) {
    const [
      thumbWidth,
      thumbHeight,
      thumbCount,
      columns,
      rows,
      intervalMs,
      name,
      sigh,
    ] = parts[i].split("#");

    if (!thumbWidth || !thumbHeight) continue;

    const url = new URL(baseUrl.toString());
    if (sigh) url.searchParams.set("sigh", sigh);

    const cols = Number(columns) || 1;
    const rowCount = Number(rows) || 1;
    const count = Number(thumbCount) || 1;
    const level = i - 1;

    boards.push({
      level,
      templateUrl: url
        .toString()
        .replace("$L", String(level))
        .replace("$N", name || "0"),
      thumbWidth: Number(thumbWidth),
      thumbHeight: Number(thumbHeight),
      thumbCount: count,
      columns: cols,
      rows: rowCount,
      intervalMs: Number(intervalMs) || 5000,
      sheetCount: Math.ceil(count / (cols * rowCount)),
    });
  }

  return boards;
}

function pickStoryboardFrame(
  boards: StoryboardBoard[],
  timeMs: number,
): StoryboardFrame | null {
  if (!boards.length) return null;

  const board =
    [...boards].reverse().find((b) => b.intervalMs <= 10000) || boards[0];

  const frameIdx = Math.min(
    Math.floor(timeMs / board.intervalMs),
    board.thumbCount - 1,
  );
  const perSheet = board.columns * board.rows;
  const sheetIdx = Math.floor(frameIdx / perSheet);
  const posInSheet = frameIdx % perSheet;
  const col = posInSheet % board.columns;
  const row = Math.floor(posInSheet / board.columns);

  const url = board.templateUrl.replace("$N", String(sheetIdx));

  return {
    url,
    x: col * board.thumbWidth,
    y: row * board.thumbHeight,
    w: board.thumbWidth,
    h: board.thumbHeight,
  };
}

function runFfmpeg(args: string[]): Promise<void> {
  const ffmpeg = getFfmpegPath();
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (c) => {
      stderr += c.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exit ${code}`));
    });
    proc.on("error", reject);
  });
}

/** Frame do storyboard do YouTube (fallback sem worker/yt-dlp). */
export async function extractStoryboardThumbnail(
  videoId: string,
  timeSec: number,
  outWidth: number,
  outHeight: number,
): Promise<Buffer | null> {
  const player = await fetchPlayerResponse(videoId);
  const spec = player.storyboards?.playerStoryboardSpecRenderer?.spec;
  if (!spec) return null;

  const boards = parseStoryboardSpec(spec);
  const frame = pickStoryboardFrame(boards, Math.max(0, timeSec * 1000));
  if (!frame) return null;

  const spriteRes = await fetch(frame.url, { cache: "no-store" });
  if (!spriteRes.ok) return null;

  const spriteBuf = Buffer.from(await spriteRes.arrayBuffer());
  const dir = await mkdtemp(join(tmpdir(), "sb-thumb-"));
  const spritePath = join(dir, "sprite.jpg");
  const outPath = join(dir, "out.jpg");

  try {
    await writeFile(spritePath, spriteBuf);
    await runFfmpeg([
      "-y",
      "-i",
      spritePath,
      "-vf",
      `crop=${frame.w}:${frame.h}:${frame.x}:${frame.y},scale=${outWidth}:${outHeight}:flags=lanczos`,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      outPath,
    ]);
    return readFile(outPath);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
