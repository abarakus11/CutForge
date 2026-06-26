"use client";

import Image from "next/image";
import { useState } from "react";
import { PlayCircle, Clock } from "lucide-react";
import type { VideoMeta } from "@/types";
import { formatTimecode } from "@/utils/format";

/** Compact preview of the validated YouTube video. */
export function VideoPreview({ video }: { video: VideoMeta }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white/[0.03] p-3 backdrop-blur-xl">
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-ink-600 sm:w-40">
        {!imgError ? (
          <Image
            src={video.thumbnail}
            alt={video.title}
            fill
            sizes="160px"
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/20">
            <PlayCircle className="h-8 w-8" />
          </div>
        )}
        <div className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white/90 backdrop-blur">
          {formatTimecode(video.duration)}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-medium text-white">
          {video.title}
        </h3>
        <p className="mt-1 truncate text-sm text-white/50">{video.channel}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/40">
          <Clock className="h-3.5 w-3.5" />
          {formatTimecode(video.duration)} de vídeo
        </p>
      </div>
    </div>
  );
}
