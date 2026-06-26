import { cn } from "@/utils/cn";

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

/** Small uppercase label with a leading gradient dot — used above headings. */
export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-white/55 backdrop-blur",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-spark-gradient shadow-[0_0_8px_2px_rgba(124,147,255,0.6)]" />
      {children}
    </span>
  );
}
