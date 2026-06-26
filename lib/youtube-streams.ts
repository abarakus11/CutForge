import { Innertube } from "youtubei.js";
import {
  fetchInnertubePlayer,
  type InnertubePlayerResponse,
} from "@/lib/innertube-shared";
import { pickStreamUrls, type StreamUrls } from "@/lib/stream-pick";

function mapYoutubeiStreamingData(
  streamingData: {
    formats?: Array<{
      url?: string;
      mime_type?: string;
      height?: number;
    }>;
    adaptive_formats?: Array<{
      url?: string;
      mime_type?: string;
      height?: number;
    }>;
  } | null,
): InnertubePlayerResponse {
  return {
    streamingData: {
      formats: (streamingData?.formats ?? []).map((f) => ({
        url: f.url,
        mimeType: f.mime_type,
        height: f.height,
      })),
      adaptiveFormats: (streamingData?.adaptive_formats ?? []).map((f) => ({
        url: f.url,
        mimeType: f.mime_type,
        height: f.height,
      })),
    },
  };
}

/** Resolve direct YouTube stream URLs on the server (Node.js). */
export async function fetchStreamsServer(
  videoId: string,
): Promise<StreamUrls | null> {
  try {
    const yt = await Innertube.create({
      lang: "pt",
      location: "BR",
      retrieve_player: true,
    });
    const info = await yt.getInfo(videoId);
    const mapped = mapYoutubeiStreamingData(info.streaming_data ?? null);
    const picked = pickStreamUrls(mapped);
    if (picked) return picked;
  } catch (err) {
    console.warn("[youtube-streams] youtubei.js:", err);
  }

  try {
    const player = await fetchInnertubePlayer(videoId);
    if (player) {
      const picked = pickStreamUrls(player);
      if (picked) return picked;
    }
  } catch (err) {
    console.warn("[youtube-streams] innertube:", err);
  }

  return null;
}
