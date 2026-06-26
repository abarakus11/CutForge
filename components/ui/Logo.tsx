import { cn } from "@/utils/cn";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

/**
 * The CutForge mark: a cut/scissor notch fused with a forge spark.
 * Drawn as inline SVG so it inherits currentColor and scales crisply.
 */
export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-spark-gradient shadow-glow">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-[18px] w-[18px] text-white"
          aria-hidden="true"
        >
          {/* Spark / blade */}
          <path
            d="M12 2.5l2.6 6.4 6.9.5-5.3 4.5 1.7 6.7L12 17.6 6.1 21.1l1.7-6.7L2.5 9.9l6.9-.5L12 2.5z"
            fill="rgba(255,255,255,0.95)"
          />
          <circle cx="12" cy="12.4" r="2.1" fill="#5B8CFF" />
        </svg>
      </span>
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-white">
          CutForge
          <span className="ml-1 text-white/45">AI</span>
        </span>
      )}
    </span>
  );
}
