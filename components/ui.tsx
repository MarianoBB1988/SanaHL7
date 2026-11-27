import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Piezas visuales de DESIGN.md ("Fey"): cards #191919 flotando con un halo
 * negro, controles en píldora fantasma (definidos por forma y luz, no por relleno).
 */

export function Card({
  children,
  className = "",
  padded = true,
  ...rest
}: ComponentProps<"section"> & { padded?: boolean }) {
  return (
    <section
      className={`animate-enter rounded-card border border-hairline bg-paper shadow-card ${padded ? "p-6" : ""} ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="text-caption font-medium uppercase text-mid-gray">{children}</p>
  );
}

const buttonBase =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill px-4 text-body font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

export const buttonStyles = {
  /** Acción principal: píldora fantasma con halo de luz. */
  primary: `${buttonBase} border border-line bg-page text-ink shadow-glow hover:border-ink/40 hover:shadow-[rgba(0,0,0,0.85)_0px_1px_0px_0px,rgba(255,255,255,0.4)_0px_0px_18px_0px]`,
  /** Secundaria: pozo oscuro, sin borde. */
  secondary: `${buttonBase} bg-canvas text-mist hover:bg-white/10 hover:text-ink`,
  /** Terciaria: solo contorno. */
  outline: `${buttonBase} border border-line bg-transparent text-mist hover:border-ink/40 hover:text-ink hover:shadow-glow-soft`,
  disabled: `${buttonBase} border border-hairline bg-transparent text-smoke cursor-not-allowed`,
};

/** Enlace de paginación; si no hay destino, se muestra deshabilitado (no clickeable). */
export function PagerLink({
  href,
  children,
  rel,
}: {
  href: string | null;
  children: ReactNode;
  rel?: string;
}) {
  if (!href) {
    return (
      <span aria-disabled="true" className={buttonStyles.disabled}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={buttonStyles.outline}>
      {children}
    </Link>
  );
}

export type BadgeTone = "solid" | "soft" | "outline" | "error" | "warm" | "positive";

/** Badge en píldora. El color solo cuando significa algo (warm = urgente, positive = completo). */
export function Badge({ children, tone = "soft" }: { children: ReactNode; tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    solid: "bg-ink text-page",
    soft: "bg-white/[0.06] text-mist",
    outline: "border border-line text-mist",
    error: "border border-danger/50 bg-danger/10 text-danger",
    warm: "border border-ember/40 bg-ember/10 text-ember",
    positive: "border border-growth/40 text-growth",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-caption font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="font-mono text-caption break-all">{children}</code>;
}

/** Barra de carga con barrido de luz. */
export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-4 rounded-small ${className}`} />;
}
