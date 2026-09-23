export const metadata = { title: "Sin conexión" };
export default function Offline() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl">📡</p>
      <h1 className="text-xl font-bold">Sin conexión</h1>
      <p className="max-w-xs text-sm text-muted">Novotic Fleet necesita internet para registrar retiros, devoluciones y reservas. Vuelve a intentarlo cuando tengas señal.</p>
      <a href="/" className="btn-primary mt-2">Reintentar</a>
    </div>
  );
}
