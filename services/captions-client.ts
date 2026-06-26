import { buildTranscribedClipAss } from "@/lib/clip-captions";

/** Gera legendas ASS via transcrição IA (Whisper no worker). */
export async function buildClipAssClient(
  videoId: string,
  clipStart: number,
  clipEnd: number,
  width: number,
  height: number,
  captionLang?: string | null,
  highlightColor?: string | null,
  captionFont?: string | null,
): Promise<string | null> {
  return buildTranscribedClipAss(
    videoId,
    clipStart,
    clipEnd,
    width,
    height,
    captionLang,
    highlightColor,
    captionFont,
  );
}
