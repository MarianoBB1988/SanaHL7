import type { Metadata } from "next";
import { Geist, Geist_Mono, Lexend } from "next/font/google";
import Link from "next/link";
import { AboutDialog } from "@/components/AboutDialog";
import "./globals.css";

// Fuentes de Google, descargadas en el build y servidas desde la app
// (el navegador no pide nada a Google y el texto no "salta" al cargar).

/** Texto e interfaz. */
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: "variable",
});

/** Títulos (h1 y títulos de sección). Alternativa probada: DM_Sans (cambiar solo el nombre). */
const heading = Geist({
  variable: "--font-heading-src",
  subsets: ["latin"],
});

// Monoespaciada solo para JSON e ids.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SanaHL7",
  description: "Visor clínico por paciente sobre el estándar HL7 FHIR R4.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${lexend.variable} ${heading.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-dvh bg-page text-body text-ink">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-pill focus:bg-paper focus:px-3 focus:py-2"
        >
          Saltar al contenido
        </a>
        <header className="border-b border-hairline">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4 sm:px-6">
            <Link
              href="/"
              className="group flex items-center gap-2 rounded-pill transition-opacity hover:opacity-80"
            >
              <span
                aria-hidden
                className="inline-block size-2 rounded-full bg-signal shadow-[0_0_10px_rgba(71,159,250,0.8)]"
              />
              <span className="text-body-lg font-semibold tracking-tight">SanaHL7</span>
            </Link>
            <span className="text-mid-gray">Visor FHIR R4</span>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <AboutDialog />
            <p className="text-right text-caption text-mid-gray sm:text-body">
              Prototipo desarrollado por{" "}
              <a
                href="https://portafolio-marian.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink underline decoration-line underline-offset-4 transition-colors duration-200 hover:text-signal hover:decoration-signal"
              >
                Mariano Bastarreix
                <span className="sr-only"> (portfolio, se abre en una pestaña nueva)</span>
                <span aria-hidden className="ml-0.5 inline-block text-mid-gray">
                  ↗
                </span>
              </a>
            </p>
            </div>
          </div>
        </header>
        <main id="contenido" className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-16">
          {children}
        </main>
      </body>
    </html>
  );
}
