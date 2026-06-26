"use client";

import { cn } from "@/utils/cn";
import type { FlowStep } from "@/types";

const STEPS: { id: FlowStep; label: string }[] = [
  { id: "url", label: "Link" },
  { id: "format", label: "Formato" },
  { id: "processing", label: "Processar" },
  { id: "results", label: "Cortes" },
];

export function StepIndicator({ current }: { current: FlowStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="mb-8 flex items-center justify-center gap-2.5">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.id} className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full text-[11px] font-medium transition-all duration-300",
                  active && "bg-spark-gradient text-white shadow-glow",
                  done && "bg-white/10 text-white/70",
                  !active && !done && "border border-line text-white/30",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-medium transition-colors sm:block",
                  active ? "text-white" : "text-white/35",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "h-px w-6 transition-colors duration-300 sm:w-8",
                  i < currentIndex ? "bg-spark-glow/50" : "bg-line",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
