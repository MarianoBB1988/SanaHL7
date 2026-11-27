import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-5 shadow-card">
      <h1 className="text-subheading font-semibold">Página no encontrada</h1>
      <p className="text-mid-gray">
        La dirección no existe o el id no tiene formato de id FHIR (letras, dígitos,
        “-” y “.”, hasta 64 caracteres).
      </p>
      <div>
        <Link href="/" className={buttonStyles.outline}>
          Volver a pacientes
        </Link>
      </div>
    </section>
  );
}
