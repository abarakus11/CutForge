const YT_FLAGS = {
  noPlaylist: true,
  noWarnings: true,
  extractorArgs: "youtube:player_client=android,web",
} as const;

const streamCache = new Map<string, { url: string; at: number }>();
const STREAM_TTL_MS = 30 * 60 * 1000;

type YtDlpClient = {
  (url: string, flags?: Record<string, unknown>): Promise<unknown>;
};

/** Resolve a direct stream URL for ffmpeg (muxed mp4 preferred). */
export async function resolveVideoStreamUrl(
  ytDlp: YtDlpClient,
  videoId: string,
): Promise<string> {
  const cached = streamCache.get(videoId);
  if (cached && Date.now() - cached.at < STREAM_TTL_MS) {
    return cached.url;
  }

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
    streamCache.set(videoId, { url: muxed.url, at: Date.now() });
    return muxed.url;
  }

  const video = formats
    .filter((f) => f.vcodec !== "none" && f.acodec === "none")
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

  if (video?.url) {
    streamCache.set(videoId, { url: video.url, at: Date.now() });
    return video.url;
  }

  throw new Error("streams indisponíveis");
}
