/** Max source height when downloading / streaming from YouTube. */
export const MAX_SOURCE_HEIGHT = 2160;

/** yt-dlp format strings — prefer H.264 up to 4K, then fall back gracefully. */
export const YTDLP_CLIP_FORMAT_ATTEMPTS = [
  `bestvideo[vcodec^=avc1][height<=${MAX_SOURCE_HEIGHT}]+bestaudio[ext=m4a]/bestvideo[vcodec^=avc1][height<=${MAX_SOURCE_HEIGHT}]+bestaudio`,
  `bestvideo[height<=${MAX_SOURCE_HEIGHT}][vcodec^=avc1]+bestaudio/bestvideo[height<=${MAX_SOURCE_HEIGHT}]+bestaudio`,
  `bestvideo[height<=${MAX_SOURCE_HEIGHT}]+bestaudio/best[height<=${MAX_SOURCE_HEIGHT}]/best`,
  "bestvideo+bestaudio/best",
] as const;

export const YTDLP_STREAM_FORMAT = YTDLP_CLIP_FORMAT_ATTEMPTS[0];

/** ffmpeg encoding tuned for social clips. */
export function encodeSettingsForQuality(quality: "preview" | "full"): {
  preset: string;
  crf: string;
  audioBitrate: string;
} {
  if (quality === "full") {
    return { preset: "medium", crf: "17", audioBitrate: "320k" };
  }
  return { preset: "fast", crf: "22", audioBitrate: "192k" };
}
