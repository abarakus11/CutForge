import { cn } from "@/utils/cn";
import { TAG_META } from "@/config/constants";
import type { ClipTag } from "@/types";

/** Colored pill for an AI moment category. */
export function TagBadge({ tag }: { tag: ClipTag }) {
  const meta = TAG_META[tag];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}
