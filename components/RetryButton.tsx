"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { buttonStyles } from "./ui";

/** Vuelve a pedir los datos del servidor sin recargar toda la página. */
export function RetryButton({ label = "Reintentar" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={buttonStyles.primary}
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Reintentando…" : label}
    </button>
  );
}
