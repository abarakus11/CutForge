/** Formatting helpers for timecodes and durations. */

/** 125 → "2:05", 3661 → "1:01:01" */
export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 42 → "42s", 95 → "1m 35s" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/** 0.92 → "92%" */
export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}
