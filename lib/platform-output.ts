import type { PlatformId } from "@/types";

export type RenderQuality = "preview" | "full";

export interface PlatformOutput {
  width: number;
  height: number;
  label: string;
}

/** Output resolution per social platform — 4K when the aspect allows. */
export const PLATFORM_OUTPUT: Record<PlatformId, PlatformOutput> = {
  shorts: { width: 2160, height: 3840, label: "9:16 4K" },
  reels: { width: 2160, height: 3840, label: "9:16 4K" },
  tiktok: { width: 2160, height: 3840, label: "9:16 4K" },
  twitter: { width: 2160, height: 2160, label: "1:1 4K" },
  facebook: { width: 3840, height: 2160, label: "16:9 4K" },
};

const VALID_FORMATS = new Set<PlatformId>([
  "shorts",
  "reels",
  "tiktok",
  "twitter",
  "facebook",
]);

export function parsePlatformFormat(value: string | null): PlatformId {
  if (value && VALID_FORMATS.has(value as PlatformId)) {
    return value as PlatformId;
  }
  return "shorts";
}

export function parseRenderQuality(value: string | null): RenderQuality {
  return value === "preview" ? "preview" : "full";
}

/** Scaled output — preview and download use full platform resolution. */
export function outputForQuality(
  format: PlatformId,
  _quality: RenderQuality,
): PlatformOutput {
  return PLATFORM_OUTPUT[format];
}

/** Center-crop to target aspect ratio, then scale to platform resolution. */
export function buildCropScaleFilter(width: number, height: number): string {
  const ar = width / height;
  return [
    `crop=w='if(gt(a\\,${ar})\\,ih*${ar}\\,iw)':h='if(gt(a\\,${ar})\\,ih\\,iw/${ar})':x='(iw-ow)/2':y='(ih-oh)/2'`,
    `scale=${width}:${height}:flags=lanczos`,
    "setsar=1",
  ].join(",");
}
