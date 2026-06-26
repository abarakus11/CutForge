export interface StreamUrls {
  /** Primary media URL (video-only or muxed). */
  videoUrl: string;
  /** Separate audio URL when video has no audio track. */
  audioUrl?: string;
  height: number;
  combined: boolean;
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

  // Prefer muxed MP4 (simpler for ffmpeg.wasm — one input).
  const muxed = combined
    .filter(
      (f) =>
        f.url &&
        f.mimeType?.includes("video") &&
        f.mimeType?.includes("mp4") &&
        !f.mimeType?.includes("audio"),
    )
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const muxed720 =
    muxed.find((f) => (f.height || 0) <= 720 && f.mimeType?.includes("avc1")) ??
    muxed.find((f) => (f.height || 0) <= 720) ??
    muxed.find((f) => f.mimeType?.includes("avc1")) ??
    muxed[0];

  if (muxed720?.url) {
    return {
      videoUrl: muxed720.url,
      height: muxed720.height || 720,
      combined: true,
    };
  }

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

  const video =
    videos.find(
      (f) => f.mimeType?.includes("avc1") && (f.height || 0) <= 1080,
    ) ??
    videos.find((f) => f.mimeType?.includes("avc1")) ??
    videos[0];
  const audio = audios[0];

  if (!video?.url || !audio?.url) return null;

  return {
    videoUrl: video.url,
    audioUrl: audio.url,
    height: video.height || 1080,
    combined: false,
  };
}
