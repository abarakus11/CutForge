"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

const NAV_LINKS = [
  { label: "Recursos", href: "#recursos" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Preços", href: "#precos" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "py-2.5" : "py-4",
      )}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav
          className={cn(
            "flex items-center justify-between rounded-2xl px-4 transition-all duration-300",
            scrolled
              ? "h-14 glass-strong shadow-soft"
              : "h-14 border border-transparent",
          )}
        >
          <a href="#top" className="shrink-0" aria-label="CutForge AI — início">
            <Logo />
          </a>

          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Login space is reserved now; wire to auth later without layout shift. */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              aria-label="Entrar (em breve)"
            >
              Entrar
            </Button>
            <Button size="sm" className="hidden sm:inline-flex">
              <Sparkles className="h-4 w-4" />
              Começar grátis
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
