import { Logo } from "@/components/ui/Logo";
import { BRAND } from "@/config/constants";

const FOOTER_LINKS = [
  { label: "Sobre", href: "#" },
  { label: "Privacidade", href: "#" },
  { label: "Termos", href: "#" },
  { label: "Contato", href: "#" },
];

export function Footer() {
  return (
    <footer className="relative mt-32 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div className="space-y-4">
            <Logo variant="full" />
          </div>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-white/55 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
          <p className="text-xs text-white/35">
            © {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </p>
          {/* Discreet, intentional credit — small and quiet by request. */}
          <p className="text-[11px] tracking-tight text-white/25 transition-colors hover:text-white/45">
            Desenvolvido por {BRAND.author}
          </p>
        </div>
      </div>
    </footer>
  );
}
