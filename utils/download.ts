/**
 * Client-side download helpers.
 *
 * Requests rendered MP4 segments from `/api/clips/download`.
 */
import type { CaptionSettings, Clip } from "@/types";

function triggerDownload(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sanitize(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "corte"
  );
}

async function fetchClipBlob(
  clip: Clip,
  videoId: string,
  videoDuration?: number,
  captions?: CaptionSettings,
): Promise<Blob> {
  const params = new URLSearchParams({
    videoId,
    start: String(clip.start),
    end: String(clip.end),
    title: clip.title,
    format: clip.format || "shorts",
    captionLang: captions?.language || "auto",
    highlightColor: captions?.highlightColor || "#FFFF00",
  });
  if (videoDuration && videoDuration > 0) {
    params.set("duration", String(Math.floor(videoDuration)));
  }

  const res = await fetch(`/api/clips/download?${params}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Falha ao baixar o corte");
  }

  return res.blob();
}

/** Download a single clip as MP4. */
export async function downloadClip(
  clip: Clip,
  videoId: string,
  videoDuration?: number,
  captions?: CaptionSettings,
) {
  const blob = await fetchClipBlob(clip, videoId, videoDuration, captions);
  const filename = `${sanitize(clip.title)}.mp4`;
  const href = URL.createObjectURL(blob);
  triggerDownload(filename, href);
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

/** Download every clip sequentially as individual MP4 files. */
export async function downloadAllClips(
  clips: Clip[],
  videoId: string,
  videoDuration?: number,
  captions?: CaptionSettings,
) {
  for (const clip of clips) {
    await downloadClip(clip, videoId, videoDuration, captions);
    await new Promise((r) => setTimeout(r, 400));
  }
}
