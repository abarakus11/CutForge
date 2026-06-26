import { configureYtdlForServerless } from "@/lib/ytdl-vercel";
import { isVercelRuntime } from "@/lib/youtube-meta";
import ytdl from "@distube/ytdl-core";
import { ytDlp, watchUrl, YT_DLP_FLAGS } from "@/lib/ytdlp";
import {
  fetchInnertubePlayer,
  INNERTUBE_FALLBACK_KEY,
  type InnertubePlayerResponse,
} from "@/lib/innertube-shared";
import { pickStreamUrls, pickYtDlpStreamUrls, type StreamUrls } from "@/lib/stream-pick";
import {
  fetchInnertubeWithVisitor,
  fetchVisitorData,
} from "@/lib/youtube-visitor";

const EXTRA_CLIENTS = [
  {
    clientName: "ANDROID",
    clientVersion: "20.10.38",
    androidSdkVersion: 30,
    hl: "pt",
    gl: "BR",
  },
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

const RESOLVER_TIMEOUT_MS = isVercelRuntime() ? 12_000 : 45_000;

function withTimeout<T>(
  promise: Promise<T | null>,
  ms = RESOLVER_TIMEOUT_MS,
): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function streamsFromYtdl(videoId: string): Promise<StreamUrls | null> {
  configureYtdlForServerless();
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

  return pickYtDlpStreamUrls(info.formats || []);
}

async function streamsFromInnertubePlayer(
  videoId: string,
): Promise<StreamUrls | null> {
  const player = await fetchInnertubePlayer(videoId);
  return player ? pickStreamUrls(player) : null;
}

async function streamsFromVisitorClients(
  videoId: string,
): Promise<StreamUrls | null> {
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
  return null;
}

async function raceStreamResolvers(
  videoId: string,
): Promise<StreamUrls | null> {
  const tasks: Array<Promise<StreamUrls | null>> = [
    withTimeout(streamsFromYtdl(videoId)),
    withTimeout(streamsFromInnertubePlayer(videoId)),
    withTimeout(streamsFromVisitorClients(videoId)),
  ];

  if (!isVercelRuntime()) {
    tasks.unshift(withTimeout(streamsFromYtDlp(videoId)));
  }

  const results = await Promise.all(tasks);
  return results.find((r) => r?.videoUrl) ?? null;
}

/** Resolve direct YouTube stream URLs on the server (Node.js). */
export async function fetchStreamsServer(
  videoId: string,
): Promise<StreamUrls | null> {
  configureYtdlForServerless();
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

  return raceStreamResolvers(videoId);
}
