/**
 * YouTube metadata via HTTP — works on Vercel/serverless (no yt-dlp binary).
 */

export interface YouTubeVideoMeta {
  title: string;
  channel: string;
  duration: number;
}

export interface YouTubeVideoMetaResolved extends YouTubeVideoMeta {
  id: string;
  /** True when title/channel came from oEmbed but duration must be resolved client-side. */
  needsClientDuration?: boolean;
}

export interface YouTubeCaptionTrack {
  lang: string;
  label: string;
  auto: boolean;
  baseUrl?: string;
}

const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const INNERTUBE_FALLBACK_KEY = "AIzaSyAO_FJ2SlbwU7RmtKx_thw_vz3mce3NZSY";

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
  {
    clientName: "MWEB",
    clientVersion: "2.20240221.09.00",
    hl: "pt",
    gl: "BR",
  },
  {
    clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    clientVersion: "2.0",
    hl: "pt",
    gl: "BR",
  },
  {
    clientName: "WEB_EMBEDDED_PLAYER",
    clientVersion: "1.20240101.00.00",
    hl: "pt",
    gl: "BR",
  },
];

interface PlayerResponse {
  videoDetails?: {
    title?: string;
    author?: string;
    lengthSeconds?: string;
  };
  playabilityStatus?: { status?: string; reason?: string };
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
  storyboards?: {
    playerStoryboardSpecRenderer?: { spec?: string };
  };
}

function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function extractJsonBlock(html: string, marker: string): unknown | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const start = html.indexOf("{", idx);
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseIso8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    Number(match[1] || 0) * 3600 +
    Number(match[2] || 0) * 60 +
    Number(match[3] || 0)
  );
}

async function fetchWatchPage(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(watchUrl(videoId), {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function apiKeyFromHtml(html: string): string {
  const match =
    html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ||
    html.match(/INNERTUBE_API_KEY\\":\\"([^"\\]+)/);
  return match?.[1] || INNERTUBE_FALLBACK_KEY;
}

async function fetchInnertubePlayer(
  videoId: string,
  apiKey: string = INNERTUBE_FALLBACK_KEY,
): Promise<PlayerResponse | null> {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": UA,
            "Accept-Language": "pt-BR,pt;q=0.9",
            Origin: "https://www.youtube.com",
            Referer: watchUrl(videoId),
          },
          body: JSON.stringify({
            context: { client },
            videoId,
          }),
          cache: "no-store",
        },
      );

      if (!res.ok) continue;

      const data = (await res.json()) as PlayerResponse;
      if (
        data.videoDetails?.lengthSeconds &&
        data.playabilityStatus?.status !== "LOGIN_REQUIRED"
      ) {
        return data;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchOEmbed(
  videoId: string,
): Promise<{ title: string; channel: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(videoId))}&format=json`,
      {
        headers: { "User-Agent": UA },
        cache: "no-store",
      },
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
    };

    if (!data.title) return null;

    return {
      title: data.title,
      channel: data.author_name || "YouTube",
    };
  } catch {
    return null;
  }
}

async function fetchViaDataApi(
  videoId: string,
): Promise<YouTubeVideoMetaResolved | null> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return null;

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${key}`,
      { cache: "no-store" },
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      items?: Array<{
        snippet?: { title?: string; channelTitle?: string };
        contentDetails?: { duration?: string };
      }>;
    };

    const item = data.items?.[0];
    if (!item?.snippet?.title) return null;

    const duration = parseIso8601Duration(item.contentDetails?.duration || "");
    if (!duration) return null;

    return {
      id: videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle || "YouTube",
      duration,
    };
  } catch {
    return null;
  }
}

export async function fetchPlayerResponse(videoId: string): Promise<PlayerResponse> {
  const direct = await fetchInnertubePlayer(videoId, INNERTUBE_FALLBACK_KEY);
  if (direct?.videoDetails?.lengthSeconds) return direct;

  const html = await fetchWatchPage(videoId);
  if (html) {
    const apiKey = apiKeyFromHtml(html);
    const fromInnertube = await fetchInnertubePlayer(videoId, apiKey);
    if (fromInnertube?.videoDetails?.lengthSeconds) return fromInnertube;

    const embedded = extractJsonBlock(
      html,
      "ytInitialPlayerResponse",
    ) as PlayerResponse | null;

    if (embedded?.videoDetails?.lengthSeconds) return embedded;
  }

  throw new Error("Não foi possível ler os dados do vídeo no YouTube");
}

/** True when running on Vercel — yt-dlp/ffmpeg subprocesses are unreliable. */
export function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

function playerToMeta(
  id: string,
  data: PlayerResponse,
): YouTubeVideoMetaResolved {
  const duration = Number(data.videoDetails?.lengthSeconds);
  if (!duration || duration <= 0) {
    throw new Error("Duração do vídeo indisponível");
  }

  return {
    id,
    title: data.videoDetails?.title?.trim() || "Vídeo do YouTube",
    channel: data.videoDetails?.author?.trim() || "YouTube",
    duration,
  };
}

/** Fetch title, channel and duration without yt-dlp. */
export async function fetchYouTubeMetaHttp(
  videoId: string,
): Promise<YouTubeVideoMeta> {
  const data = await fetchPlayerResponse(videoId);
  return playerToMeta(videoId, data);
}

/** List caption tracks from YouTube player data (no yt-dlp). */
export async function fetchYouTubeCaptionTracksHttp(
  videoId: string,
): Promise<YouTubeCaptionTrack[]> {
  const data = await fetchPlayerResponse(videoId);
  const tracks =
    data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  return tracks
    .filter((t) => t.languageCode)
    .map((t) => ({
      lang: t.languageCode!,
      label: t.name?.simpleText || t.languageCode!,
      auto: t.kind === "asr",
      baseUrl: t.baseUrl,
    }));
}

/** Download WebVTT captions from a track baseUrl (no yt-dlp). */
export async function downloadCaptionVttHttp(baseUrl: string): Promise<string> {
  const url = baseUrl.includes("fmt=")
    ? baseUrl.replace(/fmt=[^&]+/, "fmt=vtt")
    : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}fmt=vtt`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Falha ao baixar legendas (HTTP ${res.status})`);
  }

  return res.text();
}

/** Positions where "l" and "I" get confused when copying YouTube links. */
function ambiguousLI(id: string): number[] {
  return [...id].flatMap((c, i) => (c === "l" || c === "I" ? [i] : []));
}

/** Generate ID variants flipping l↔I (max 32 combos). */
function* idVariants(id: string): Generator<string> {
  yield id;
  const positions = ambiguousLI(id);
  if (!positions.length || positions.length > 5) return;

  const total = 1 << positions.length;
  for (let mask = 1; mask < total; mask++) {
    const chars = id.split("");
    for (let b = 0; b < positions.length; b++) {
      if (mask & (1 << b)) {
        const pos = positions[b];
        chars[pos] = chars[pos] === "l" ? "I" : "l";
      }
    }
    yield chars.join("");
  }
}

async function tryResolveVariant(
  variant: string,
): Promise<YouTubeVideoMetaResolved | null> {
  const fromApi = await fetchViaDataApi(variant);
  if (fromApi) return fromApi;

  const player = await fetchInnertubePlayer(variant, INNERTUBE_FALLBACK_KEY);
  if (player?.videoDetails?.lengthSeconds) {
    return playerToMeta(variant, player);
  }

  const oembed = await fetchOEmbed(variant);
  if (!oembed) return null;

  const html = await fetchWatchPage(variant);
  if (html) {
    const embedded = extractJsonBlock(
      html,
      "ytInitialPlayerResponse",
    ) as PlayerResponse | null;

    if (embedded?.videoDetails?.lengthSeconds) {
      return {
        id: variant,
        title: embedded.videoDetails?.title?.trim() || oembed.title,
        channel: embedded.videoDetails?.author?.trim() || oembed.channel,
        duration: Number(embedded.videoDetails.lengthSeconds),
      };
    }
  }

  return {
    id: variant,
    title: oembed.title,
    channel: oembed.channel,
    duration: 0,
    needsClientDuration: true,
  };
}

/**
 * Resolve canonical ID + metadata (oEmbed / Data API / Innertube).
 * On Vercel, Innertube is often blocked — oEmbed + client duration is used.
 */
export async function resolveAndFetchYouTubeMeta(
  rawId: string,
): Promise<YouTubeVideoMetaResolved> {
  for (const variant of idVariants(rawId)) {
    const resolved = await tryResolveVariant(variant);
    if (!resolved) continue;

    if (variant !== rawId) {
      console.info(`[youtube] ID corrigido: ${rawId} → ${variant}`);
    }
    return resolved;
  }

  throw new Error("Não foi possível ler os dados do vídeo no YouTube");
}

/** @deprecated Use resolveAndFetchYouTubeMeta */
export async function resolveYouTubeVideoId(rawId: string): Promise<string> {
  const meta = await resolveAndFetchYouTubeMeta(rawId);
  return meta.id;
}
