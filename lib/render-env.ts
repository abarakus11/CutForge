/** True when clip render must run in the browser (Vercel has no ffmpeg/yt-dlp). */
export function shouldUseClientRender(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_FORCE_CLIENT_RENDER === "1") return true;
  return /\.vercel\.app$/i.test(window.location.hostname);
}
