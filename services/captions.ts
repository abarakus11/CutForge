import type { SubtitleTrack } from "@/types";

export async function fetchSubtitleLanguages(
  videoId: string,
): Promise<SubtitleTrack[]> {
  const res = await fetch(
    `/api/youtube/captions/languages?videoId=${encodeURIComponent(videoId)}`,
  );

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Falha ao carregar idiomas de legenda");
  }

  const data = (await res.json()) as { tracks: SubtitleTrack[] };
  return data.tracks;
}
