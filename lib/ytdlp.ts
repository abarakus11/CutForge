import { join } from "path";
import { create as createYtDlp } from "youtube-dl-exec";
import {
  YTDLP_CLIP_FORMAT_ATTEMPTS,
  YTDLP_STREAM_FORMAT,
} from "@/lib/video-quality";

function binPath(...segments: string[]) {
  return join(process.cwd(), "node_modules", ...segments);
}

export function getYtDlpPath() {
  return binPath(
    "youtube-dl-exec",
    "bin",
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
  );
}

import ffmpegStatic from "ffmpeg-static";
import { chmodSync, existsSync } from "fs";

export function getFfmpegPath() {
  if (typeof ffmpegStatic === "string" && ffmpegStatic) {
    if (existsSync(ffmpegStatic)) {
      try {
        chmodSync(ffmpegStatic, 0o755);
      } catch {
        // permissão já ok
      }
    }
    return ffmpegStatic;
  }

  return binPath(
    "ffmpeg-static",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );
}

const rawYtDlp = createYtDlp(getYtDlpPath());

/** Default flags — android client avoids most YouTube bot-check blocks. */
export const YT_DLP_FLAGS = {
  noPlaylist: true,
  noWarnings: true,
  extractorArgs: "youtube:player_client=android,web",
} as const;

type YtDlpFlags = Record<
  string,
  string | number | boolean | string[] | undefined
>;

/** yt-dlp wrapper with YouTube-friendly defaults applied to every call. */
export function ytDlp(url: string, flags: YtDlpFlags = {}) {
  return rawYtDlp(url, { ...YT_DLP_FLAGS, ...flags });
}

/** @deprecated Use ytDlp — kept as alias for gradual migration. */
export const youtubedl = ytDlp;

export function watchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

const STREAM_URL_TTL_MS = 30 * 60 * 1000;
const streamUrlCache = new Map<string, { url: string; at: number }>();

/** Prefer up to 4K — H.264 first, then best available codec. */
export const YTDLP_BEST_FORMAT_ATTEMPTS = [...YTDLP_CLIP_FORMAT_ATTEMPTS];

export { YTDLP_STREAM_FORMAT };

/** Cached direct stream URL (up to 4K) for ffmpeg extraction. */
export async function getCachedStreamUrl(videoId: string): Promise<string> {
  const hit = streamUrlCache.get(videoId);
  if (hit && Date.now() - hit.at < STREAM_URL_TTL_MS) return hit.url;

  const streamUrl = await ytDlp(watchUrl(videoId), {
    format: YTDLP_STREAM_FORMAT,
    getUrl: true,
  });

  if (typeof streamUrl !== "string") {
    throw new Error("URL de stream indisponível");
  }

  streamUrlCache.set(videoId, { url: streamUrl, at: Date.now() });
  return streamUrl;
}
