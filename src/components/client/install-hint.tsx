"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void> };

/** Instalar como app: Android/Chrome usa el diálogo nativo; iOS requiere "Agregar a inicio". */
export function InstallHint() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIos, setShowIos] = useState(false);
  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (installed) return <p className="btn-secondary w-full justify-start text-ok"><Smartphone className="h-5 w-5" /> App instalada</p>;
  return (
    <div>
      <button type="button" className="btn-secondary w-full justify-start" onClick={() => (evt ? evt.prompt() : setShowIos(true))}>
        <Smartphone className="h-5 w-5" /> Instalar en el teléfono
      </button>
      {showIos && (
        <p className="mt-2 rounded-xl bg-surface-2 p-3 text-xs text-muted">
          {ios ? "En Safari toca Compartir (□↑) y luego «Agregar a pantalla de inicio»." : "Abre el menú del navegador (⋮) y elige «Instalar app» o «Agregar a pantalla principal»."}
        </p>
      )}
    </div>
  );
}
