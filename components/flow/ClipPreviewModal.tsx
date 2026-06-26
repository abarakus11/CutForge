"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Download, Loader2 } from "lucide-react";
import type { CaptionSettings, Clip, PlatformId, VideoMeta } from "@/types";
import { TagBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatTimecode, formatScore, formatDuration } from "@/utils/format";
import { downloadClip } from "@/utils/download";
import { renderClipBlob } from "@/utils/download";
import { shouldUseClientRender } from "@/lib/render-env";
import { prefetchFfmpegClient } from "@/services/clip-render-client";
import {
  aspectLabelForFormat,
  modalWidthClassForFormat,
  playerFrameStyle,
} from "@/utils/platform";

interface ClipPreviewModalProps {
  clip: Clip | null;
  video: VideoMeta;
  selectedFormat: PlatformId;
  captions: CaptionSettings;
  onClose: () => void;
}

const PREVIEW_TIMEOUT_MS = 600_000;

export function ClipPreviewModal({
  clip,
  video,
  selectedFormat,
  captions,
  onClose,
}: ClipPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");

  const clipFormat = clip?.format || selectedFormat;
  const clipId = clip?.id;
  const clipStart = clip?.start;
  const clipEnd = clip?.end;
  const clientRender = shouldUseClientRender();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (clientRender) prefetchFfmpegClient();
  }, [clientRender]);

  useEffect(() => {
    if (!clip) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [clip]);

  useEffect(() => {
    if (!clipId || clipStart == null || clipEnd == null) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);

    setLoading(true);
    setPreviewError(null);
    setPreviewSrc(null);
    setProgress(0);
    setProgressMsg(
      clientRender ? "Preparando renderização no navegador…" : "Renderizando prévia…",
    );

    renderClipBlob(
      video.id,
      clipStart,
      clipEnd,
      clipFormat,
      video.duration,
      captions,
      (pct, msg) => {
        setProgress(pct);
        setProgressMsg(msg);
      },
    )
      .then((blob) => {
        if (controller.signal.aborted) return;
        setPreviewSrc(URL.createObjectURL(blob));
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setPreviewError(
            err.message || "Não foi possível carregar a prévia em 4K.",
          );
        }
        setLoading(false);
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [
    clipId,
    clipStart,
    clipEnd,
    clipFormat,
    video.id,
    video.duration,
    captions,
    clientRender,
  ]);

  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(previewSrc);
      }
    };
  }, [previewSrc]);

  const handleDownload = async () => {
    if (!clip || downloading) return;
    setDownloading(true);
    setProgress(0);
    setProgressMsg("Gerando vídeo para download…");
    try {
      await downloadClip(
        clip,
        video.id,
        video.duration,
        captions,
        (pct, msg) => {
          setProgress(pct);
          setProgressMsg(msg);
        },
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao baixar o corte");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted || !clip) return null;

  const frameStyle = playerFrameStyle(clipFormat);
  const showLoader = loading && !previewError;
  const showProgress = (showLoader || downloading) && clientRender && progressMsg;

  const modal = (
    <AnimatePresence>
      <motion.div
        key="clip-preview-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 6 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className={`relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl border border-line bg-ink-700/95 shadow-soft backdrop-blur-2xl ${modalWidthClassForFormat(clipFormat)}`}
        >
          <div className="relative shrink-0 border-b border-line bg-black p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-white/40">
                Prévia 4K • {aspectLabelForFormat(clipFormat)}
              </span>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="clip-preview-frame relative overflow-hidden rounded-xl bg-black"
              style={frameStyle}
            >
              {previewSrc && !previewError && (
                <video
                  key={previewSrc}
                  src={previewSrc}
                  controls
                  autoPlay
                  playsInline
                  controlsList="nofullscreen noremoteplayback"
                  disablePictureInPicture
                  onLoadedData={() => setLoading(false)}
                  onCanPlay={() => setLoading(false)}
                  onError={() => {
                    setPreviewError("Erro ao reproduzir o vídeo.");
                    setLoading(false);
                  }}
                  className="clip-preview-video h-full w-full"
                />
              )}

              {previewError && (
                <div className="absolute inset-0 z-20 grid place-items-center bg-ink-600 p-4 text-center text-sm text-white/50">
                  {previewError}
                </div>
              )}

              {showLoader && (
                <div className="absolute inset-0 z-30 grid place-items-center bg-ink-600/95 px-4">
                  <div className="flex w-full max-w-xs flex-col items-center gap-3 text-center text-white/60">
                    <Loader2 className="h-7 w-7 animate-spin text-spark-violet" />
                    <span className="text-sm">
                      {progressMsg || "Renderizando prévia em 4K com legendas…"}
                    </span>
                    {clientRender && progress > 0 && (
                      <div className="w-full">
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-spark-gradient transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="mt-1 block text-xs text-white/35">
                          {progress}%
                        </span>
                      </div>
                    )}
                    {!clientRender && (
                      <span className="text-xs text-white/35">
                        Máxima qualidade — reutiliza cache após a 1ª vez
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div>
              <h3 className="text-lg font-medium tracking-tight text-white">
                {clip.title}
              </h3>
              <p className="mt-1 font-mono text-sm text-white/45">
                {formatTimecode(clip.start)} → {formatTimecode(clip.end)} •{" "}
                {formatDuration(clip.duration)} • {formatScore(clip.score)} viral
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {clip.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>

            {showProgress && downloading && (
              <p className="text-center text-xs text-white/40">{progressMsg}</p>
            )}

            <Button
              variant="glass"
              className="w-full"
              size="lg"
              disabled={downloading || loading}
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              {downloading
                ? `Gerando vídeo… ${progress > 0 ? `${progress}%` : ""}`
                : "Baixar este corte em 4K"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
