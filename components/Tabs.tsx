"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabDef {
  id: string;
  label: string;
  /** Cantidad de registros; null si no se sabe (p. ej. consulta fallida). */
  count: number | null;
  /** Marca visible si la consulta quedó incompleta. */
  incomplete?: boolean;
  /** Pista corta junto al nombre (p. ej. "verificada"). */
  hint?: string;
}

/**
 * Pestañas accesibles (patrón WAI-ARIA): flechas, Inicio y Fin mueven el foco
 * y activan la pestaña. La pestaña activa queda en la URL (?tab=…) sin volver
 * a pedir datos: todos los paneles ya llegaron del servidor.
 */
export function Tabs({
  label,
  tabs,
  panels,
  initial,
  param = "tab",
}: {
  label: string;
  tabs: TabDef[];
  panels: Record<string, ReactNode>;
  initial: string;
  param?: string;
}) {
  const valid = tabs.some((t) => t.id === initial) ? initial : tabs[0].id;
  const [active, setActive] = useState(valid);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: string, focus = false) {
    setActive(id);
    if (focus) refs.current[id]?.focus();
    const url = new URL(window.location.href);
    if (id === tabs[0].id) url.searchParams.delete(param);
    else url.searchParams.set(param, id);
    window.history.replaceState(null, "", url);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const target =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (target === null) return;
    e.preventDefault();
    select(tabs[target].id, true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto rounded-pill border border-line bg-paper p-1 shadow-card sm:self-start"
      >
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`relative inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-pill px-4 font-medium transition-colors duration-200 after:absolute after:inset-x-4 after:-bottom-px after:h-px after:origin-center after:bg-signal after:shadow-[0_0_8px_rgba(71,159,250,0.9)] after:transition-transform after:duration-300 after:ease-out ${
                selected
                  ? "bg-white/[0.06] text-ink after:scale-x-100"
                  : "text-mid-gray after:scale-x-0 hover:text-ink"
              }`}
            >
              {t.label}
              <span
                className={`rounded-pill px-1.5 text-caption tabular-nums transition-colors duration-200 ${
                  selected ? "bg-ink text-page" : "bg-white/[0.08] text-mist"
                }`}
              >
                {t.count ?? "?"}
                <span className="sr-only"> registros</span>
              </span>
              {t.incomplete && (
                <span className="text-caption text-danger" title="Consulta incompleta">
                  !<span className="sr-only"> consulta incompleta</span>
                </span>
              )}
              {t.hint && (
                <span className="hidden text-caption font-normal text-mid-gray md:inline">
                  {t.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          // `animate-enter` se reinicia cada vez que el panel pasa de oculto a visible.
          className="animate-enter outline-none focus-visible:rounded-card focus-visible:ring-2 focus-visible:ring-ink"
        >
          {panels[t.id]}
        </div>
      ))}
    </div>
  );
}
