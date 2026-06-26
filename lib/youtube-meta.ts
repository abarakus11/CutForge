/**
 * YouTube metadata via HTTP — works on Vercel/serverless (no yt-dlp binary).
 */

export interface YouTubeVideoMeta {
  title: string;
  channel: string;
  duration: number;
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

async function fetchWatchPage(videoId: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`YouTube retornou HTTP ${res.status}`);
  }

  return res.text();
}

function apiKeyFromHtml(html: string): string {
  const match =
    html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ||
    html.match(/INNERTUBE_API_KEY\\":\\"([^"\\]+)/);
  return match?.[1] || INNERTUBE_FALLBACK_KEY;
}

async function fetchInnertubePlayer(
  videoId: string,
  apiKey: string,
): Promise<PlayerResponse | null> {
  const clients = [
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
      clientName: "ANDROID",
      clientVersion: "19.09.37",
      androidSdkVersion: 30,
      hl: "pt",
      gl: "BR",
    },
  ];

  for (const client of clients) {
    try {
      const res = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": UA,
            "Accept-Language": "pt-BR,pt;q=0.9",
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
      if (data.videoDetails?.lengthSeconds) return data;
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchPlayerResponse(videoId: string): Promise<PlayerResponse> {
  const html = await fetchWatchPage(videoId);
  const apiKey = apiKeyFromHtml(html);

  const fromInnertube = await fetchInnertubePlayer(videoId, apiKey);
  if (fromInnertube?.videoDetails?.lengthSeconds) return fromInnertube;

  const embedded = extractJsonBlock(
    html,
    "ytInitialPlayerResponse",
  ) as PlayerResponse | null;

  if (embedded?.videoDetails?.lengthSeconds) return embedded;

  throw new Error("Não foi possível ler os dados do vídeo no YouTube");
}

/** True when running on Vercel — yt-dlp/ffmpeg subprocesses are unreliable. */
export function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

/** Fetch title, channel and duration without yt-dlp. */
export async function fetchYouTubeMetaHttp(
  videoId: string,
): Promise<YouTubeVideoMeta> {
  const data = await fetchPlayerResponse(videoId);
  const duration = Number(data.videoDetails?.lengthSeconds);

  if (!duration || duration <= 0) {
    throw new Error("Duração do vídeo indisponível");
  }

  return {
    title: data.videoDetails?.title?.trim() || "Vídeo do YouTube",
    channel: data.videoDetails?.author?.trim() || "YouTube",
    duration,
  };
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

async function oembedExists(id: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
      { cache: "no-store" },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve the canonical 11-char ID. Fixes l/I typos from copy-paste
 * (e.g. tRLiw7wwli8 → tRLiw7wwIi8).
 */
export async function resolveYouTubeVideoId(rawId: string): Promise<string> {
  for (const variant of idVariants(rawId)) {
    if (await oembedExists(variant)) {
      if (variant !== rawId) {
        console.info(`[youtube] ID corrigido: ${rawId} → ${variant}`);
      }
      return variant;
    }
  }

  throw new Error("Não foi possível ler os dados do vídeo no YouTube");
}
