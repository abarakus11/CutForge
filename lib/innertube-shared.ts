/**
 * Innertube player fetch — works in browser (user IP) and Node.
 */

import { pickStreamUrls as pickStreams, type StreamUrls } from "@/lib/stream-pick";

export type { StreamUrls };

const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

export const INNERTUBE_FALLBACK_KEY = "AIzaSyAO_FJ2SlbwU7RmtKx_thw_vz3mce3NZSY";

const INNERTUBE_CLIENTS = [
  {
    clientName: "ANDROID",
    clientVersion: "20.10.38",
    androidSdkVersion: 30,
    hl: "en",
    gl: "US",
  },
  {
    clientName: "WEB",
    clientVersion: "2.20240221.09.00",
    hl: "pt",
    gl: "BR",
  },
];

export interface InnertubeFormat {
  url?: string;
  mimeType?: string;
  height?: number;
  audioQuality?: string;
  qualityLabel?: string;
}

export interface InnertubePlayerResponse {
  videoDetails?: {
    title?: string;
    author?: string;
    lengthSeconds?: string;
  };
  playabilityStatus?: { status?: string; reason?: string };
  streamingData?: {
    formats?: InnertubeFormat[];
    adaptiveFormats?: InnertubeFormat[];
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: Array<{
        languageCode?: string;
        name?: { simpleText?: string };
        kind?: string;
        baseUrl?: string;
      }>;
    };
  };
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export async function fetchInnertubePlayer(
  videoId: string,
): Promise<InnertubePlayerResponse | null> {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_FALLBACK_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": UA,
            Accept: "application/json",
            Origin: "https://www.youtube.com",
            Referer: watchUrl(videoId),
          },
          body: JSON.stringify({ context: { client }, videoId }),
        },
      );

      if (!res.ok) continue;

      const data = (await res.json()) as InnertubePlayerResponse;
      if (data.playabilityStatus?.status === "LOGIN_REQUIRED") continue;
      if (data.streamingData || data.videoDetails?.lengthSeconds) return data;
    } catch {
      continue;
    }
  }

  return null;
}

export function pickStreamUrls(
  data: InnertubePlayerResponse,
): StreamUrls | null {
  return pickStreams(data);
}

export async function getYouTubeStreamUrls(
  videoId: string,
): Promise<StreamUrls> {
  const player = await fetchInnertubePlayer(videoId);
  if (!player) {
    throw new Error("Não foi possível obter o stream do vídeo");
  }

  const streams = pickStreamUrls(player);
  if (!streams) {
    throw new Error("URLs de stream indisponíveis para este vídeo");
  }

  return streams;
}
