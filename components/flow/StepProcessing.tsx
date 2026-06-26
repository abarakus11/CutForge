"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useProcessingProgress } from "@/hooks/useProcessingProgress";
import type { VideoMeta } from "@/types";
import { cn } from "@/utils/cn";

interface StepProcessingProps {
  video: VideoMeta;
  onComplete: () => void;
}

/** Number of bars in the signature "forge timeline" scanner. */
const BAR_COUNT = 48;

export function StepProcessing({ video, onComplete }: StepProcessingProps) {
  const { progress, stageIndex, stages } = useProcessingProgress({
    durationMs: 5400,
    onComplete,
  });

  const pct = Math.round(progress * 100);
  const activeBars = Math.round(progress * BAR_COUNT);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div className="rounded-3xl border border-line bg-white/[0.025] p-6 backdrop-blur-xl sm:p-8">
        {/* Signature: a timeline being scanned + lit, segment by segment */}
        <div className="relative mb-7 flex h-24 items-end gap-[3px] overflow-hidden rounded-xl bg-ink-700/60 px-3 py-3">
          {Array.from({ length: BAR_COUNT }).map((_, i) => {
            const lit = i < activeBars;
            const isEdge = i === activeBars - 1;
            // Pseudo-random heights, stable per index.
            const h = 26 + ((i * 37) % 64);
            return (
              <span
                key={i}
                className={cn(
                  "flex-1 rounded-sm transition-all duration-300",
                  lit ? "bg-spark-gradient" : "bg-white/[0.06]",
                  isEdge && "shadow-[0_0_12px_2px_rgba(124,147,255,0.7)]",
                )}
                style={{ height: `${lit ? h : Math.max(14, h * 0.4)}%` }}
              />
            );
          })}
          {/* Scan line riding the leading edge */}
          <motion.span
            className="pointer-events-none absolute inset-y-2 w-px bg-spark-glow shadow-[0_0_16px_4px_rgba(124,147,255,0.8)]"
            style={{ left: `calc(${Math.min(progress * 100, 98)}% )` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm text-white/40">Processando</p>
            <p className="truncate text-[15px] font-medium text-white">
              {video.title}
            </p>
          </div>
          <span className="font-mono text-2xl font-semibold tabular-nums text-spark">
            {pct}%
          </span>
        </div>

        {/* Progress bar with moving shimmer */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="relative h-full rounded-full bg-spark-gradient transition-[width] duration-150 ease-out"
            style={{ width: `${pct}%` }}
          >
            <span className="absolute inset-0 -skew-x-12 animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </div>
        </div>

        {/* Staged checklist */}
        <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
          {stages.map((stage, i) => {
            const done = i < stageIndex;
            const active = i === stageIndex;
            return (
              <li
                key={stage.label}
                className={cn(
                  "flex items-center gap-2.5 text-sm transition-colors",
                  done && "text-white/55",
                  active && "text-white",
                  !done && !active && "text-white/30",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all",
                    done && "border-spark-glow/40 bg-spark-glow/15 text-spark-glow",
                    active && "border-spark-glow/60 bg-spark-glow/10 text-spark-glow",
                    !done && !active && "border-line text-white/20",
                  )}
                >
                  {done ? (
                    <Check className="h-3 w-3" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-current" />
                  )}
                </span>
                {stage.label}
                {active && <span className="text-white/40">…</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}
