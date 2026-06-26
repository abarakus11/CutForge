/** True when clip render must run in the browser (Vercel has no ffmpeg/yt-dlp). */
export function shouldUseClientRender(): boolean {
  if (typeof window === "undefined") return false;

  if (process.env.NEXT_PUBLIC_FORCE_CLIENT_RENDER === "1") return true;

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return false;

  return /\.vercel\.app$/i.test(host) || host.includes("vercel.app");
}
