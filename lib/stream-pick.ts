import { MAX_SOURCE_HEIGHT } from "@/lib/video-quality";

export interface StreamUrls {
  /** Primary media URL (video-only or muxed). */
  videoUrl: string;
  /** Separate audio URL when video has no audio track. */
  audioUrl?: string;
  height: number;
  combined: boolean;
}

interface StreamCandidate {
  url?: string;
  mimeType?: string;
  height?: number;
  vcodec?: string;
  acodec?: string;
  ext?: string;
}

function isH264(candidate: StreamCandidate): boolean {
  const codec = `${candidate.vcodec || ""} ${candidate.mimeType || ""}`;
  return codec.includes("avc1") || codec.includes("h264");
}

function pickAdaptiveStreams(
  videos: StreamCandidate[],
  audios: StreamCandidate[],
): StreamUrls | null {
  const video =
    videos.find((f) => isH264(f) && (f.height || 0) <= MAX_SOURCE_HEIGHT) ??
    videos.find((f) => isH264(f)) ??
    videos[0];
  const audio =
    audios.find((f) => (f.mimeType || f.ext || "").includes("m4a")) ??
    audios[0];

  if (!video?.url || !audio?.url) return null;

  return {
    videoUrl: video.url,
    audioUrl: audio.url,
    height: video.height || 1080,
    combined: false,
  };
}

/** Pick best stream URLs from yt-dlp `dumpSingleJson` formats. */
export function pickYtDlpStreamUrls(
  formats: StreamCandidate[],
): StreamUrls | null {
  const valid = formats.filter((f) => f.url);

  const videos = valid
    .filter((f) => f.vcodec !== "none" && f.acodec === "none")
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const audios = valid
    .filter((f) => f.acodec !== "none" && f.vcodec === "none")
    .sort((a, b) => {
      const aMp4 = (a.ext || "").includes("m4a") ? 1 : 0;
      const bMp4 = (b.ext || "").includes("m4a") ? 1 : 0;
      return bMp4 - aMp4;
    });

  const adaptive = pickAdaptiveStreams(videos, audios);
  if (adaptive) return adaptive;

  const muxed = valid
    .filter((f) => f.vcodec !== "none" && f.acodec !== "none")
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const bestMuxed =
    muxed.find((f) => isH264(f) && (f.height || 0) <= MAX_SOURCE_HEIGHT) ??
    muxed.find((f) => isH264(f)) ??
    muxed[0];

  if (!bestMuxed?.url) return null;

  return {
    videoUrl: bestMuxed.url,
    height: bestMuxed.height || 720,
    combined: true,
  };
}

/** Pick best stream URLs from Innertube player data. */
export function pickStreamUrls(
  data: {
    streamingData?: {
      formats?: Array<{
        url?: string;
        mimeType?: string;
        height?: number;
      }>;
      adaptiveFormats?: Array<{
        url?: string;
        mimeType?: string;
        height?: number;
      }>;
    };
  },
): StreamUrls | null {
  const combined = data.streamingData?.formats ?? [];
  const adaptive = data.streamingData?.adaptiveFormats ?? [];

  const videos = adaptive
    .filter((f) => f.url && f.mimeType?.includes("video"))
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const audios = adaptive
    .filter((f) => f.url && f.mimeType?.includes("audio"))
    .sort((a, b) => {
      const aMp4 = a.mimeType?.includes("mp4a") ? 1 : 0;
      const bMp4 = b.mimeType?.includes("mp4a") ? 1 : 0;
      return bMp4 - aMp4;
    });

  const adaptivePick = pickAdaptiveStreams(videos, audios);
  if (adaptivePick) return adaptivePick;

  const muxed = combined
    .filter(
      (f) =>
        f.url &&
        f.mimeType?.includes("video") &&
        !f.mimeType?.includes("audio"),
    )
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const bestMuxed =
    muxed.find(
      (f) =>
        f.mimeType?.includes("avc1") &&
        (f.height || 0) <= MAX_SOURCE_HEIGHT,
    ) ??
    muxed.find((f) => f.mimeType?.includes("avc1")) ??
    muxed[0];

  if (!bestMuxed?.url) return null;

  return {
    videoUrl: bestMuxed.url,
    height: bestMuxed.height || 720,
    combined: true,
  };
}
