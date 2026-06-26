/** True when clip render must run in the browser (fallback only). */
export function shouldUseClientRender(): boolean {
  if (typeof window === "undefined") return false;

  if (process.env.NEXT_PUBLIC_FORCE_CLIENT_RENDER === "1") return true;

  // Worker ou API serverless cuidam do render na Vercel.
  if (process.env.NEXT_PUBLIC_CLIP_WORKER_URL) return false;

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return false;

  return false;
}
