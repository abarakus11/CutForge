/** Gera legendas ASS via API Vercel (Whisper no worker). */
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
  const params = new URLSearchParams({
    videoId,
    start: String(Math.floor(clipStart)),
    end: String(Math.floor(clipEnd)),
    width: String(width),
    height: String(height),
    captionLang: captionLang || "auto",
    highlightColor: highlightColor || "#FFFF00",
    captionFont: captionFont || "arial-black",
  });

  try {
    const res = await fetch(`/api/youtube/captions/ass?${params}`, {
      signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok) return null;
    const ass = await res.text();
    return ass.includes("Dialogue:") ? ass : null;
  } catch {
    return null;
  }
}
