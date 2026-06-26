import type { CSSProperties } from "react";
import type { PlatformId } from "@/types";
import { PLATFORM_OUTPUT } from "@/lib/platform-output";

/** Display width (px) for the player frame in the modal. */
function displayWidthForFormat(format: PlatformId): number {
  if (format === "shorts" || format === "reels" || format === "tiktok") {
    return 300;
  }
  if (format === "twitter") return 360;
  return 640;
}

/** Inline frame style — avoids Tailwind JIT missing dynamic aspect classes. */
export function playerFrameStyle(format: PlatformId): CSSProperties {
  const { width, height } = PLATFORM_OUTPUT[format];
  const displayWidth = displayWidthForFormat(format);

  return {
    width: "100%",
    maxWidth: displayWidth,
    aspectRatio: `${width} / ${height}`,
    marginLeft: "auto",
    marginRight: "auto",
  };
}

/** Crop a 16:9 YouTube embed to match the target platform frame. */
export function embedCoverStyle(format: PlatformId): CSSProperties {
  const { width, height } = PLATFORM_OUTPUT[format];
  const targetAr = width / height;
  const videoAr = 16 / 9;

  if (Math.abs(targetAr - videoAr) < 0.05) {
    return {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      border: "none",
    };
  }

  if (targetAr < videoAr) {
    const coverWidth = `${((videoAr / targetAr) * 100).toFixed(2)}%`;
    return {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: coverWidth,
      height: "100%",
      transform: "translate(-50%, -50%)",
      border: "none",
    };
  }

  const coverHeight = `${((targetAr / videoAr) * 100).toFixed(2)}%`;
  return {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "100%",
    height: coverHeight,
    transform: "translate(-50%, -50%)",
    border: "none",
  };
}

/** YouTube embed URL for instant clip preview (start → end). */
export function youtubeEmbedForClip(
  videoId: string,
  start: number,
  end: number,
): string {
  const params = new URLSearchParams({
    start: String(Math.floor(start)),
    end: String(Math.ceil(end)),
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    fs: "0",
    controls: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}

/** Human-readable aspect label for the UI. */
export function aspectLabelForFormat(format: PlatformId): string {
  return PLATFORM_OUTPUT[format].label;
}

/** Modal shell max-width. */
export function modalWidthClassForFormat(format: PlatformId): string {
  if (format === "shorts" || format === "reels" || format === "tiktok") {
    return "max-w-[360px]";
  }
  if (format === "twitter") return "max-w-md";
  return "max-w-2xl";
}

/** Card thumbnail frame style. */
export function cardFrameStyle(format: PlatformId): CSSProperties {
  const { width, height } = PLATFORM_OUTPUT[format];
  return {
    width: "100%",
    aspectRatio: `${width} / ${height}`,
  };
}
