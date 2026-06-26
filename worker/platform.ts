export type PlatformId =
  | "shorts"
  | "reels"
  | "tiktok"
  | "twitter"
  | "facebook";

export type RenderQuality = "preview" | "full";

export interface PlatformOutput {
  width: number;
  height: number;
  label: string;
}

const PLATFORM_OUTPUT: Record<PlatformId, PlatformOutput> = {
  shorts: { width: 2160, height: 3840, label: "9:16 4K" },
  reels: { width: 2160, height: 3840, label: "9:16 4K" },
  tiktok: { width: 2160, height: 3840, label: "9:16 4K" },
  twitter: { width: 2160, height: 2160, label: "1:1 4K" },
  facebook: { width: 3840, height: 2160, label: "16:9 4K" },
};

const VALID = new Set<PlatformId>([
  "shorts",
  "reels",
  "tiktok",
  "twitter",
  "facebook",
]);

export function parsePlatformFormat(value: string | null | undefined): PlatformId {
  if (value && VALID.has(value as PlatformId)) return value as PlatformId;
  return "shorts";
}

export function parseRenderQuality(value: string | null | undefined): RenderQuality {
  return value === "preview" ? "preview" : "full";
}

export function outputForQuality(
  format: PlatformId,
  quality: RenderQuality,
): PlatformOutput {
  const full = PLATFORM_OUTPUT[format];
  if (quality === "full") return full;
  return {
    width: Math.round(full.width / 2),
    height: Math.round(full.height / 2),
    label: full.label.replace("4K", "HD"),
  };
}

export function buildCropScaleFilter(width: number, height: number): string {
  const ar = width / height;
  return [
    `crop=w='if(gt(a\\,${ar})\\,ih*${ar}\\,iw)':h='if(gt(a\\,${ar})\\,ih\\,iw/${ar})':x='(iw-ow)/2':y='(ih-oh)/2'`,
    `scale=${width}:${height}:flags=lanczos`,
    "setsar=1",
  ].join(",");
}
