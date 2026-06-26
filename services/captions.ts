import type { SubtitleTrack } from "@/types";
import { CAPTION_LANG_LABELS } from "@/config/constants";
import { shouldUseClientRender } from "@/lib/render-env";

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
          }>;
        };
      };
    };
  };
  return data.player ?? null;
}

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
  const player = await fetchPlayerFromApi(videoId);
  const tracks =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  return tracks
    .filter((t) => t.languageCode)
    .map((t) => ({
      lang: t.languageCode!,
      label: labelForLang(t.languageCode!, t.kind === "asr"),
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
