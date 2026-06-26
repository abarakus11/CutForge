import type { SubtitleTrack } from "@/types";
import { TRANSCRIPTION_LANGUAGES } from "@/config/constants";

/** Idiomas de transcrição Whisper (não usa legendas do YouTube). */
export async function fetchSubtitleLanguages(
  _videoId: string,
): Promise<SubtitleTrack[]> {
  const res = await fetch("/api/youtube/captions/languages");
  if (res.ok) {
    const data = (await res.json()) as { tracks: SubtitleTrack[] };
    return data.tracks;
  }

  return TRANSCRIPTION_LANGUAGES.map((t) => ({
    lang: t.lang,
    label: t.label,
    auto: t.lang === "auto",
  }));
}
