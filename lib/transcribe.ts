import { fetchFromClipWorker } from "@/lib/worker-proxy";
import type { CaptionCue, WordCue } from "@/lib/captions-core";
import { mergeWordCues } from "@/lib/captions-core";

export interface TranscriptionResult {
  language: string;
  words: WordCue[];
  cues: CaptionCue[];
}

/** Transcreve um trecho via worker (Whisper). */
export async function transcribeClipSegment(
  videoId: string,
  start: number,
  end: number,
  lang?: string | null,
): Promise<TranscriptionResult | null> {
  const params = new URLSearchParams({
    videoId,
    start: String(Math.floor(start)),
    end: String(Math.floor(end)),
    captionLang: lang || "auto",
  });

  const res = await fetchFromClipWorker(`/transcribe?${params}`, 300_000);
  if (!res) return null;

  const data = (await res.json()) as {
    language?: string;
    words?: WordCue[];
    cues?: CaptionCue[];
  };

  const words = data.words || [];
  const cues = data.cues?.length ? data.cues : mergeWordCues(words);
  if (!cues.length) return null;

  return {
    language: data.language || lang || "pt",
    words,
    cues,
  };
}
