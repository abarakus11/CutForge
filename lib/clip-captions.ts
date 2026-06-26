import {
  buildClipAss,
  parseCaptionFont,
  parseHighlightColor,
  resolveCaptionFontAssName,
  type CaptionCue,
} from "@/lib/captions-core";
import { CAPTION_FONTS } from "@/lib/caption-fonts";
import { transcribeClipSegment } from "@/lib/transcribe";
import { fetchFromClipWorker } from "@/lib/worker-proxy";

/** Gera ASS com legendas transcritas (Whisper) para um trecho. */
export async function buildTranscribedClipAss(
  videoId: string,
  clipStart: number,
  clipEnd: number,
  width: number,
  height: number,
  captionLang?: string | null,
  highlightColor?: string | null,
  captionFont?: string | null,
): Promise<string | null> {
  const fontId = parseCaptionFont(captionFont, CAPTION_FONTS);
  const workerParams = new URLSearchParams({
    videoId,
    start: String(Math.floor(clipStart)),
    end: String(Math.floor(clipEnd)),
    width: String(width),
    height: String(height),
    captionLang: captionLang || "auto",
    highlightColor: highlightColor || "#FFFF00",
    captionFont: fontId,
  });

  const workerRes = await fetchFromClipWorker(
    `/captions/ass?${workerParams}`,
    300_000,
  );
  if (workerRes) {
    const ass = await workerRes.text();
    if (ass.includes("Dialogue:")) return ass;
  }

  const transcription = await transcribeClipSegment(
    videoId,
    clipStart,
    clipEnd,
    captionLang,
  );
  if (!transcription?.cues.length) return null;

  const hl = parseHighlightColor(highlightColor ?? undefined);
  const fontName = resolveCaptionFontAssName(fontId, CAPTION_FONTS);
  const ass = buildClipAss(
    transcription.cues,
    0,
    clipEnd - clipStart,
    width,
    height,
    { highlightColor: hl, fontFamily: fontName },
  );

  return ass.includes("Dialogue:") ? ass : null;
}

export function cuesForClip(
  allCues: CaptionCue[],
  clipStart: number,
  clipEnd: number,
): CaptionCue[] {
  return allCues
    .filter((c) => c.end > clipStart && c.start < clipEnd)
    .map((c) => ({
      ...c,
      start: Math.max(0, c.start - clipStart),
      end: Math.min(clipEnd - clipStart, c.end - clipStart),
      words: c.words?.map((w) => ({
        ...w,
        start: Math.max(0, w.start - clipStart),
        end: Math.min(clipEnd - clipStart, w.end - clipStart),
      })),
    }));
}
