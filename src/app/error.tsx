"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">Algo salió mal</h1>
      <p className="text-sm text-muted">El error fue registrado. Intenta nuevamente.</p>
      <button onClick={reset} className="btn-primary">Reintentar</button>
    </div>
  );
}
