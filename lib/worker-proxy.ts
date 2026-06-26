/** Proxy requests to the clip worker (yt-dlp + ffmpeg). */
export function getClipWorkerUrl(): string | null {
  return process.env.CLIP_WORKER_URL?.replace(/\/$/, "") || null;
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
