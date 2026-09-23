import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">No encontrado</h1>
      <p className="text-sm text-muted">El recurso no existe o no tienes acceso.</p>
      <Link href="/" className="btn-primary">Ir al inicio</Link>
    </div>
  );
}
