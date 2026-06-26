"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Package, RotateCcw, Scissors } from "lucide-react";
import type { CaptionSettings, Clip, PlatformId, VideoMeta } from "@/types";
import { ClipCard } from "@/components/flow/ClipCard";
import { ClipPreviewModal } from "@/components/flow/ClipPreviewModal";
import { Button } from "@/components/ui/Button";
import { downloadAllClips } from "@/utils/download";
import { formatTimecode } from "@/utils/format";
import { prefetchClipPreview } from "@/services/youtube";

interface StepResultsProps {
  video: VideoMeta;
  clips: Clip[];
  selectedFormat: PlatformId;
  captions: CaptionSettings;
  onReset: () => void;
}

export function StepResults({
  video,
  clips,
  selectedFormat,
  captions,
  onReset,
}: StepResultsProps) {
  const [preview, setPreview] = useState<Clip | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const handleDownloadAll = async () => {
    if (downloadingAll) return;
    setDownloadingAll(true);
    try {
      await downloadAllClips(clips, video.id, video.duration, captions);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao baixar os cortes");
    } finally {
      setDownloadingAll(false);
    }
  };

  const totalSeconds = useMemo(
    () => clips.reduce((sum, c) => sum + c.duration, 0),
    [clips],
  );

  /** Pre-render 4K previews in background so opening a clip feels faster. */
  useEffect(() => {
    clips.forEach((clip, i) => {
      const delay = i * 2500;
      window.setTimeout(() => {
        prefetchClipPreview(
          video.id,
          clip.start,
          clip.end,
          clip.format || selectedFormat,
          video.duration,
          captions,
        );
      }, delay);
    });
  }, [clips, video.id, video.duration, selectedFormat, captions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      {/* Header */}
      <div className="flex flex-col gap-5 rounded-3xl border border-line bg-white/[0.025] p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-sm text-spark">
            <Scissors className="h-4 w-4" />
            {clips.length} cortes prontos
          </div>
          <h2 className="mt-1.5 truncate text-xl font-semibold tracking-tight text-white">
            {video.title}
          </h2>
          <p className="mt-1 text-sm text-white/45">
            {video.channel} • {formatTimecode(totalSeconds)} de conteúdo recortado
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="glass" size="lg" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Novo vídeo
          </Button>
          <Button size="lg" disabled={downloadingAll} onClick={handleDownloadAll}>
            <Package className="h-4 w-4" />
            {downloadingAll ? "Gerando cortes…" : "Baixar todos"}
          </Button>
        </div>
      </div>

      {/* Grid — every clip is shown, no cap */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((clip, i) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            index={i}
            videoId={video.id}
            videoDuration={video.duration}
            selectedFormat={selectedFormat}
            captions={captions}
            onPreview={setPreview}
          />
        ))}
      </div>

      <ClipPreviewModal
        clip={preview}
        video={video}
        selectedFormat={selectedFormat}
        captions={captions}
        onClose={() => setPreview(null)}
      />
    </motion.div>
  );
}
