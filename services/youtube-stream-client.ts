import type { StreamUrls } from "@/lib/stream-pick";

/** Fetch stream URLs via same-origin API (browser-safe). */
export async function getYouTubeStreamUrls(
  videoId: string,
): Promise<StreamUrls> {
  const res = await fetch(
    `/api/youtube/streams?videoId=${encodeURIComponent(videoId)}`,
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Não foi possível obter o stream do vídeo");
  }
  return res.json() as Promise<StreamUrls>;
}
