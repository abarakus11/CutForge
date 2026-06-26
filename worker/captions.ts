import { writeFile } from "fs/promises";
import { join } from "path";
import {
  buildClipAss,
  parseCaptionFont,
  parseHighlightColor,
  resolveCaptionFontAssName,
} from "../lib/captions-core";
import { CAPTION_FONTS } from "../lib/caption-fonts";
import { TRANSCRIPTION_LANGUAGES } from "../lib/transcription-langs";
import { transcribeMediaFile } from "./transcribe";

export { TRANSCRIPTION_LANGUAGES };

/** Gera legendas ASS via Whisper (áudio do corte) — sem YouTube. */
export async function writeWorkerClipAssFromMedia(
  mediaPath: string,
  clipDuration: number,
  width: number,
  height: number,
  workDir: string,
  captionLang?: string | null,
  highlightColor?: string | null,
  captionFont?: string | null,
): Promise<string | null> {
  try {
    const { cues } = await transcribeMediaFile(mediaPath, workDir, captionLang);
    if (!cues.length) return null;

    const hl = parseHighlightColor(highlightColor ?? undefined);
    const fontName = resolveCaptionFontAssName(
      parseCaptionFont(captionFont, CAPTION_FONTS),
      CAPTION_FONTS,
    );
    const ass = buildClipAss(cues, 0, clipDuration, width, height, {
      highlightColor: hl,
      fontFamily: fontName,
    });
    if (!ass.includes("Dialogue:")) return null;

    const assPath = join(workDir, "subs.ass");
    await writeFile(assPath, ass, "utf-8");
    return assPath;
  } catch (err) {
    console.error("[worker/captions] whisper falhou:", err);
    return null;
  }
}

export async function buildWorkerClipAssTextFromMedia(
  mediaPath: string,
  clipDuration: number,
  width: number,
  height: number,
  workDir: string,
  captionLang?: string | null,
  highlightColor?: string | null,
  captionFont?: string | null,
): Promise<string | null> {
  const assPath = await writeWorkerClipAssFromMedia(
    mediaPath,
    clipDuration,
    width,
    height,
    workDir,
    captionLang,
    highlightColor,
    captionFont,
  );
  if (!assPath) return null;
  const { readFile } = await import("fs/promises");
  return readFile(assPath, "utf-8");
}