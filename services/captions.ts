import type { SubtitleTrack } from "@/types";
import { shouldUseClientRender } from "@/lib/render-env";
import { fetchInnertubePlayer } from "@/lib/innertube-shared";
import { CAPTION_LANG_LABELS } from "@/config/constants";

function labelForLang(lang: string, auto: boolean): string {
  const base =
    CAPTION_LANG_LABELS[lang] ||
    CAPTION_LANG_LABELS[lang.split("-")[0]] ||
    lang;
  return auto ? `${base} (automática)` : base;
}

async function fetchSubtitleLanguagesClient(
  videoId: string,
): Promise<SubtitleTrack[]> {
  const player = await fetchInnertubePlayer(videoId);
  const tracks =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  return tracks
    .filter((t) => t.languageCode)
    .map((t) => ({
      lang: t.languageCode!,
      label: labelForLang(
        t.languageCode!,
        t.kind === "asr",
      ),
      auto: t.kind === "asr",
    }));
}

export async function fetchSubtitleLanguages(
  videoId: string,
): Promise<SubtitleTrack[]> {
  if (shouldUseClientRender()) {
    return fetchSubtitleLanguagesClient(videoId);
  }

  const res = await fetch(
    `/api/youtube/captions/languages?videoId=${encodeURIComponent(videoId)}`,
  );

  if (!res.ok) {
    const clientFallback = await fetchSubtitleLanguagesClient(videoId).catch(
      () => [] as SubtitleTrack[],
    );
    if (clientFallback.length) return clientFallback;

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Falha ao carregar idiomas de legenda");
  }

  const data = (await res.json()) as { tracks: SubtitleTrack[] };
  return data.tracks;
}
