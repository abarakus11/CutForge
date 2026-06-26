import ytdl from "@distube/ytdl-core";
import { Innertube } from "youtubei.js";
import { ytDlp, watchUrl, YT_DLP_FLAGS } from "@/lib/ytdlp";
import {
  fetchInnertubePlayer,
  INNERTUBE_FALLBACK_KEY,
  type InnertubePlayerResponse,
} from "@/lib/innertube-shared";
import { pickStreamUrls, type StreamUrls } from "@/lib/stream-pick";
import {
  fetchInnertubeWithVisitor,
  fetchVisitorData,
} from "@/lib/youtube-visitor";

const EXTRA_CLIENTS = [
  {
    clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    clientVersion: "2.0",
    hl: "en",
    gl: "US",
  },
  {
    clientName: "WEB_EMBEDDED_PLAYER",
    clientVersion: "1.20240101.00.00",
    hl: "en",
    gl: "US",
  },
  {
    clientName: "IOS",
    clientVersion: "19.45.4",
    deviceModel: "iPhone14,3",
    hl: "en",
    gl: "US",
  },
];

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

async function streamsFromYtdl(videoId: string): Promise<StreamUrls | null> {
  const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
  const muxed = ytdl.chooseFormat(info.formats, {
    quality: "highest",
    filter: (f) => f.hasVideo && f.hasAudio && Boolean(f.url),
  });
  if (muxed?.url) {
    return {
      videoUrl: muxed.url,
      height: muxed.height || 720,
      combined: true,
    };
  }

  const video = ytdl.chooseFormat(info.formats, {
    quality: "highestvideo",
    filter: (f) => f.hasVideo && Boolean(f.url),
  });
  const audio = ytdl.chooseFormat(info.formats, {
    quality: "highestaudio",
    filter: (f) => f.hasAudio && Boolean(f.url),
  });
  if (video?.url && audio?.url) {
    return {
      videoUrl: video.url,
      audioUrl: audio.url,
      height: video.height || 1080,
      combined: false,
    };
  }
  return null;
}

async function streamsFromYtDlp(videoId: string): Promise<StreamUrls | null> {
  const info = (await ytDlp(watchUrl(videoId), {
    ...YT_DLP_FLAGS,
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
    .filter((f) => f.vcodec !== "none" && f.acodec !== "none")
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  if (muxed?.url) {
    return {
      videoUrl: muxed.url,
      height: muxed.height || 720,
      combined: true,
    };
  }

  const video = formats
    .filter((f) => f.vcodec !== "none" && f.acodec === "none")
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  const audio = formats.find((f) => f.acodec !== "none" && f.vcodec === "none");
  if (video?.url && audio?.url) {
    return {
      videoUrl: video.url,
      audioUrl: audio.url,
      height: video.height || 1080,
      combined: false,
    };
  }
  return null;
}

/** Resolve direct YouTube stream URLs on the server (Node.js). */
export async function fetchStreamsServer(
  videoId: string,
): Promise<StreamUrls | null> {
  const workerUrl = process.env.CLIP_WORKER_URL?.replace(/\/$/, "");
  if (workerUrl) {
    try {
      const res = await fetch(
        `${workerUrl}/streams?videoId=${encodeURIComponent(videoId)}`,
        { cache: "no-store", signal: AbortSignal.timeout(25000) },
      );
      if (res.ok) {
        const data = (await res.json()) as StreamUrls;
        if (data.videoUrl) return data;
      }
    } catch (err) {
      console.warn("[youtube-streams] worker:", err);
    }
  }

  for (const fn of [
    streamsFromYtDlp,
    streamsFromYtdl,
    async (id: string) => {
      const yt = await Innertube.create({
        lang: "pt",
        location: "BR",
        retrieve_player: true,
      });
      const info = await yt.getInfo(id);
      return pickStreamUrls(mapYoutubeiStreamingData(info.streaming_data ?? null));
    },
    async (id: string) => {
      const player = await fetchInnertubePlayer(id);
      return player ? pickStreamUrls(player) : null;
    },
  ]) {
    try {
      const picked = await fn(videoId);
      if (picked) return picked;
    } catch (err) {
      console.warn("[youtube-streams]", fn.name, err);
    }
  }

  try {
    const visitorData = await fetchVisitorData();
    for (const client of EXTRA_CLIENTS) {
      const raw = (await fetchInnertubeWithVisitor(
        videoId,
        INNERTUBE_FALLBACK_KEY,
        client,
        visitorData,
      )) as InnertubePlayerResponse | null;
      if (!raw?.streamingData) continue;
      const picked = pickStreamUrls(raw);
      if (picked) return picked;
    }
  } catch (err) {
    console.warn("[youtube-streams] visitor innertube:", err);
  }

  return null;
}
