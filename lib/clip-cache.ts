const cache = new Map<string, Buffer>();
const MAX_ENTRIES = 64;

export function clipCacheKey(parts: string[]): string {
  return parts.join(":");
}

export function getCachedClip(key: string): Buffer | undefined {
  return cache.get(key);
}

export function setCachedClip(key: string, data: Buffer): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, data);
}
