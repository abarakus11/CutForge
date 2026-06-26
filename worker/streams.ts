import { pickYtDlpStreamUrls, type StreamUrls } from "../lib/stream-pick";

const YT_FLAGS = {
  noPlaylist: true,
  noWarnings: true,
  extractorArgs: "youtube:player_client=android,web",
} as const;

const streamCache = new Map<string, { streams: StreamUrls; at: number }>();
const STREAM_TTL_MS = 30 * 60 * 1000;

type YtDlpClient = {
  (url: string, flags?: Record<string, unknown>): Promise<unknown>;
};

/** Resolve the best YouTube streams for ffmpeg (up to 4K, separate A/V when possible). */
export async function resolveBestStreams(
  ytDlp: YtDlpClient,
  videoId: string,
): Promise<StreamUrls> {
  const cached = streamCache.get(videoId);
  if (cached && Date.now() - cached.at < STREAM_TTL_MS) {
    return cached.streams;
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

  const picked = pickYtDlpStreamUrls(info.formats || []);
  if (!picked) throw new Error("streams indisponíveis");

  streamCache.set(videoId, { streams: picked, at: Date.now() });
  return picked;
}

/** Back-compat: direct video URL for thumbnails. */
export async function resolveVideoStreamUrl(
  ytDlp: YtDlpClient,
  videoId: string,
): Promise<string> {
  const streams = await resolveBestStreams(ytDlp, videoId);
  return streams.videoUrl;
}
