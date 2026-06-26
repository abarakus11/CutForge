import Image from "next/image";
import { cn } from "@/utils/cn";
import { BRAND } from "@/config/constants";

export type LogoVariant = "compact" | "full";

interface LogoProps {
  className?: string;
  /** compact = navbar; full = hero/footer com slogan na imagem */
  variant?: LogoVariant;
  priority?: boolean;
}

const SIZES: Record<
  LogoVariant,
  { width: number; height: number; className: string }
> = {
  compact: {
    width: 200,
    height: 56,
    className: "h-9 w-auto max-w-[200px] object-contain object-left",
  },
  full: {
    width: 520,
    height: 220,
    className: "h-auto w-full max-w-[min(100%,520px)] object-contain object-left",
  },
};

/** Logo oficial CutForge AI (PNG 3D). */
export function Logo({
  className,
  variant = "compact",
  priority = false,
}: LogoProps) {
  const size = SIZES[variant];

  return (
    <Image
      src={BRAND.logo}
      alt={BRAND.logoAlt}
      width={size.width}
      height={size.height}
      className={cn(size.className, className)}
      priority={priority}
    />
  );
}
