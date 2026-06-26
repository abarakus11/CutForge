"use client";

/**
 * useProcessingProgress — advances a fake-but-believable progress bar through
 * weighted stages, then fires `onComplete`. The pacing is intentionally eased
 * (fast early, slower near the end) so it reads as real work, not a timer.
 *
 * When the real pipeline emits progress events, feed them in here instead of
 * the interval and the UI stays untouched.
 */
import { useEffect, useRef, useState } from "react";
import { PROCESSING_STAGES } from "@/config/constants";

interface Options {
  /** Total simulated duration in ms. */
  durationMs?: number;
  onComplete?: () => void;
}

export function useProcessingProgress({ durationMs = 5200, onComplete }: Options) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let done = false;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);

      // Ease-out so the bar decelerates as it approaches 100%.
      const eased = 1 - Math.pow(1 - t, 2.2);
      setProgress(eased);

      // Map eased progress onto cumulative stage weights.
      let acc = 0;
      let idx = 0;
      for (let i = 0; i < PROCESSING_STAGES.length; i++) {
        acc += PROCESSING_STAGES[i].weight;
        if (eased <= acc) {
          idx = i;
          break;
        }
        idx = i;
      }
      setStageIndex(idx);

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else if (!done) {
        done = true;
        setProgress(1);
        setStageIndex(PROCESSING_STAGES.length - 1);
        onCompleteRef.current?.();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return {
    progress,
    stageIndex,
    stage: PROCESSING_STAGES[stageIndex],
    stages: PROCESSING_STAGES,
  };
}
