"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import clsx from "clsx";

export type ViewerDoc = { fileId: string; mimeType: string; title: string; status: string; statusLabel: string; expiry: string };

/** Botón grande que abre el documento a pantalla completa. */
export function DocButton({ doc, variant = "default" }: { doc: ViewerDoc; variant?: "default" | "inspection" }) {
  const [open, setOpen] = useState(false);
  const bad = doc.status === "EXPIRED";
  const warn = doc.status === "EXPIRING";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-5 py-4 text-left transition active:scale-[0.99]",
          variant === "inspection" ? "min-h-[84px] border-white/20 bg-white/5 text-white" : "min-h-[72px] bg-surface",
        )}
      >
        <span>
          <span className={clsx("block font-bold", variant === "inspection" ? "text-xl" : "text-base")}>{doc.title}</span>
          <span className={clsx("block text-sm", variant === "inspection" ? "text-white/70" : "text-muted")}>Vence: {doc.expiry}</span>
        </span>
        <span className={clsx("shrink-0 rounded-full px-3 py-1 text-xs font-extrabold uppercase", bad ? "bg-red-600 text-white" : warn ? "bg-amber-500 text-black" : "bg-emerald-600 text-white")}>
          {doc.statusLabel}
        </span>
      </button>
      {open && <Viewer doc={doc} onClose={() => setOpen(false)} />}
    </>
  );
}

function Viewer({ doc, onClose }: { doc: ViewerDoc; onClose: () => void }) {
  const src = `/api/files/${doc.fileId}`;
  const isPdf = doc.mimeType === "application/pdf";
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2 pt-safe">
        <p className="truncate text-sm font-semibold">{doc.title}</p>
        <div className="flex items-center gap-1">
          <a href={src} target="_blank" rel="noreferrer" className="rounded-lg p-2.5 hover:bg-white/10" aria-label="Abrir en pestaña"><ExternalLink className="h-5 w-5" /></a>
          <a href={`${src}?download=1`} className="rounded-lg p-2.5 hover:bg-white/10" aria-label="Descargar"><Download className="h-5 w-5" /></a>
          <button onClick={onClose} className="rounded-lg p-2.5 hover:bg-white/10" aria-label="Cerrar"><X className="h-6 w-6" /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {isPdf ? (
          <iframe src={src} title={doc.title} className="h-full w-full bg-white" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={doc.title} className="max-h-full max-w-full object-contain" />
        )}
      </div>
      {isPdf && (
        <a href={src} target="_blank" rel="noreferrer" className="m-3 rounded-xl bg-white py-3 text-center font-bold text-black pb-safe">Abrir PDF completo</a>
      )}
    </div>
  );
}
