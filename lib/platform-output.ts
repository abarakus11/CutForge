import type { PlatformId } from "@/types";

export type RenderQuality = "preview" | "full";

export interface PlatformOutput {
  width: number;
  height: number;
  label: string;
}

/** Output resolution per social platform. */
export const PLATFORM_OUTPUT: Record<PlatformId, PlatformOutput> = {
  shorts: { width: 1080, height: 1920, label: "9:16 1080p" },
  reels: { width: 1080, height: 1920, label: "9:16 1080p" },
  tiktok: { width: 1080, height: 1920, label: "9:16 1080p" },
  twitter: { width: 1080, height: 1080, label: "1:1 1080p" },
  facebook: { width: 1920, height: 1080, label: "16:9 1080p" },
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

/** Scaled output — preview uses half resolution for faster renders. */
export function outputForQuality(
  format: PlatformId,
  quality: RenderQuality,
): PlatformOutput {
  const full = PLATFORM_OUTPUT[format];
  if (quality === "full") return full;
  return {
    width: Math.max(360, Math.round(full.width * 0.67)),
    height: Math.max(640, Math.round(full.height * 0.67)),
    label: full.label.replace("1080p", "720p"),
  };
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
