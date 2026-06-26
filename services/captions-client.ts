import {
  buildClipAss,
  mergeCues,
  mergeWordCues,
  parseHighlightColor,
  parseVtt,
  parseVttWords,
  type CaptionCue,
} from "@/lib/captions-core";
import { fetchInnertubePlayer } from "@/lib/innertube-shared";

function langScore(candidate: string, preferred: string): number {
  const c = candidate.toLowerCase();
  const p = preferred.toLowerCase();
  if (c === p) return 100;
  if (c.startsWith(p) || p.startsWith(c.split("-")[0])) return 80;
  if (c.split("-")[0] === p.split("-")[0]) return 60;
  return 0;
}

async function downloadCaptionVtt(baseUrl: string): Promise<string> {
  const url = baseUrl.includes("fmt=")
    ? baseUrl.replace(/fmt=[^&]+/, "fmt=vtt")
    : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}fmt=vtt`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`VTT HTTP ${res.status}`);
  return res.text();
}

/** Load captions in the browser via Innertube (Vercel-safe). */
export async function loadCaptionsClient(
  videoId: string,
  preferredLang?: string | null,
): Promise<{ cues: CaptionCue[]; language: string } | null> {
  const player = await fetchInnertubePlayer(videoId);
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
