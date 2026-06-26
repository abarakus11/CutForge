import {
  buildClipAss,
  mergeCues,
  mergeWordCues,
  parseHighlightColor,
  parseVtt,
  parseVttWords,
} from "@/lib/captions-core";

async function fetchAssFromApi(
  videoId: string,
  clipStart: number,
  clipEnd: number,
  width: number,
  height: number,
  captionLang?: string | null,
  highlightColor?: string | null,
): Promise<string | null> {
  const params = new URLSearchParams({
    videoId,
    start: String(clipStart),
    end: String(clipEnd),
    width: String(width),
    height: String(height),
    captionLang: captionLang || "auto",
    highlightColor: highlightColor || "#FFFF00",
  });

  const res = await fetch(`/api/youtube/captions/ass?${params}`);
  if (!res.ok) return null;
  const text = await res.text();
  return text.includes("Dialogue:") ? text : null;
}

async function fetchPlayerFromApi(videoId: string) {
  const res = await fetch(
    `/api/youtube/player?videoId=${encodeURIComponent(videoId)}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    player?: {
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
    };
  };
  return data.player ?? null;
}

function langScore(candidate: string, preferred: string): number {
  const c = candidate.toLowerCase();
  const p = preferred.toLowerCase();
  if (c === p) return 100;
  if (c.startsWith(p) || p.startsWith(c.split("-")[0])) return 80;
  if (c.split("-")[0] === p.split("-")[0]) return 60;
  return 0;
}

async function downloadCaptionVtt(baseUrl: string): Promise<string> {
  const vttUrl = baseUrl.includes("fmt=")
    ? baseUrl.replace(/fmt=[^&]+/, "fmt=vtt")
    : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}fmt=vtt`;

  const proxy = `/api/stream-proxy?url=${encodeURIComponent(vttUrl)}`;
  const res = await fetch(proxy);
  if (!res.ok) throw new Error(`VTT HTTP ${res.status}`);
  return res.text();
}

/** Load captions in the browser via API + Innertube fallback. */
export async function loadCaptionsClient(
  videoId: string,
  preferredLang?: string | null,
): Promise<{ cues: import("@/lib/captions-core").CaptionCue[]; language: string } | null> {
  const player = await fetchPlayerFromApi(videoId);
  const tracks =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!tracks.length) return null;

  const preferred =
    preferredLang && preferredLang !== "auto"
      ? preferredLang
      : tracks[0]?.languageCode || "pt";

  const ranked = [...tracks].sort((a, b) => {
    const scoreA =
      langScore(a.languageCode || "", preferred) + (a.kind === "asr" ? 0 : 10);
    const scoreB =
      langScore(b.languageCode || "", preferred) + (b.kind === "asr" ? 0 : 10);
    return scoreB - scoreA;
  });

  for (const track of ranked) {
    if (!track.baseUrl || !track.languageCode) continue;
    try {
      const content = await downloadCaptionVtt(track.baseUrl);
      const words = parseVttWords(content);
      const cues =
        words.length > 0
          ? mergeWordCues(words)
          : mergeCues(parseVtt(content));
      if (!cues.length) continue;
      return { cues, language: track.languageCode };
    } catch {
      continue;
    }
  }

  return null;
}

export async function buildClipAssClient(
  videoId: string,
  clipStart: number,
  clipEnd: number,
  width: number,
  height: number,
  captionLang?: string | null,
  highlightColor?: string | null,
): Promise<string | null> {
  const fromApi = await fetchAssFromApi(
    videoId,
    clipStart,
    clipEnd,
    width,
    height,
    captionLang,
    highlightColor,
  );
  if (fromApi) return fromApi;

  const captions = await loadCaptionsClient(videoId, captionLang);
  if (!captions) return null;

  const ass = buildClipAss(
    captions.cues,
    clipStart,
    clipEnd,
    width,
    height,
    { highlightColor: parseHighlightColor(highlightColor) },
  );

  return ass.includes("Dialogue:") ? ass : null;
}
