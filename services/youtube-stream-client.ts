import type { StreamUrls } from "@/lib/stream-pick";

/** Fetch stream URLs via same-origin API (browser-safe). */
export async function getYouTubeStreamUrls(
  videoId: string,
): Promise<StreamUrls> {
  let lastError = "Não foi possível obter o stream do vídeo";

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }

    const res = await fetch(
      `/api/youtube/streams?videoId=${encodeURIComponent(videoId)}`,
    );
    if (res.ok) {
      return res.json() as Promise<StreamUrls>;
    }

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    lastError = data.error || lastError;
  }

  throw new Error(lastError);
}
