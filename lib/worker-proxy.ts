/** Proxy requests to the clip worker (yt-dlp + ffmpeg). */
export function getClipWorkerUrl(): string | null {
  const raw = process.env.CLIP_WORKER_URL?.replace(/\/$/, "") || "";
  if (!raw) return null;

  // Ignora túneis locais/expirados que quebram produção.
  if (
    raw.includes("trycloudflare.com") ||
    raw.includes("localhost") ||
    raw.includes("127.0.0.1")
  ) {
    return null;
  }

  return raw;
}

export async function fetchFromClipWorker(
  path: string,
  timeoutMs = 30_000,
): Promise<Response | null> {
  const base = getClipWorkerUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? res : null;
  } catch (err) {
    console.warn("[worker-proxy]", path, err);
    return null;
  }
}

export function buildClipWorkerQuery(params: URLSearchParams): string {
  return params.toString();
}

/** Fetch rendered MP4 from worker `/clip` endpoint. */
export async function fetchClipFromWorker(
  params: URLSearchParams,
  timeoutMs = 280_000,
): Promise<Response | null> {
  return fetchFromClipWorker(`/clip?${params}`, timeoutMs);
}
