"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Play, Download, Flame } from "lucide-react";
import type { CaptionSettings, Clip, PlatformId } from "@/types";
import { clipThumbnailUrl, clipThumbnailApiUrl } from "@/lib/clip-thumbnail";
import { TagBadge } from "@/components/ui/Badge";
import { formatTimecode, formatDuration, formatScore } from "@/utils/format";
import { downloadClip } from "@/utils/download";
import { cardFrameStyle } from "@/utils/platform";

interface ClipCardProps {
  clip: Clip;
  index: number;
  videoId: string;
  videoDuration: number;
  selectedFormat: PlatformId;
  captions: CaptionSettings;
  onPreview: (clip: Clip) => void;
}

export function ClipCard({
  clip,
  index,
  videoId,
  videoDuration,
  selectedFormat,
  captions,
  onPreview,
}: ClipCardProps) {
  const initialSrc = useMemo(
    () =>
      clipThumbnailUrl(
        videoId,
        clip.start,
        clip.end,
        clip.format || selectedFormat,
      ),
    [videoId, clip.start, clip.end, clip.format, selectedFormat],
  );
  const [src, setSrc] = useState(initialSrc);
  const [imgError, setImgError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setSrc(initialSrc);
    setImgError(false);
  }, [initialSrc]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadClip(clip, videoId, videoDuration, captions);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao baixar o corte");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: Math.min(index * 0.04, 0.5),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white/[0.025] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-spark-glow/40 hover:shadow-glow"
    >
      {/* Thumbnail */}
      <div
        className="relative overflow-hidden bg-ink-600"
        style={cardFrameStyle(clip.format || selectedFormat)}
      >
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={clip.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => {
              const apiUrl = clipThumbnailApiUrl(
                videoId,
                clip.start,
                clip.end,
                clip.format || selectedFormat,
              );
              if (src !== apiUrl) {
                setSrc(apiUrl);
                return;
              }
              setImgError(true);
            }}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-ink-600 to-ink-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" />

        {/* Score badge */}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
          <Flame className="h-3 w-3 text-spark-violet" />
          {formatScore(clip.score)}
        </div>

        {/* Duration */}
        <div className="absolute bottom-3 right-3 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur">
          {formatDuration(clip.duration)}
        </div>

        {/* Hover play overlay */}
        <button
          onClick={() => onPreview(clip)}
          aria-label={`Visualizar ${clip.title}`}
          className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-spark-gradient text-white shadow-glow transition-transform duration-300 group-hover:scale-100 scale-90">
            <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
          </span>
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-white">
          {clip.title}
        </h3>

        <div className="flex flex-wrap gap-1.5">
          {clip.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2 font-mono text-xs text-white/40">
          <span>{formatTimecode(clip.start)}</span>
          <span className="h-px flex-1 bg-line" />
          <span>{formatTimecode(clip.end)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onPreview(clip)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-white/[0.03] text-sm text-white/80 transition-all hover:bg-white/[0.07] hover:text-white"
          >
            <Play className="h-3.5 w-3.5" />
            Visualizar
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-spark-gradient text-sm font-medium text-white transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Gerando…" : "Download"}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
