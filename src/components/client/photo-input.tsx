"use client";

import { useRef, useState } from "react";
import { Camera, FileUp, X } from "lucide-react";
import clsx from "clsx";

const MAX_DIM = 1600;
const QUALITY = 0.82;

/** Reduce fotos del teléfono (4-12 MB) a JPEG ~300-600 KB antes de subir. */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file; // Navegador sin soporte para el formato: se sube el original.
  }
}

/**
 * Captura de fotos con la cámara del teléfono (o archivos en escritorio).
 * `capture` abre directamente la cámara trasera en móviles.
 */
export function PhotoInput({
  name, label, required, multiple, accept = "image/*", capture = true, hint, allowPdf,
}: {
  name: string;
  label: string;
  required?: boolean;
  multiple?: boolean;
  accept?: string;
  capture?: boolean;
  hint?: string;
  allowPdf?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ url: string | null; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const acceptAttr = allowPdf ? "image/*,application/pdf" : accept;

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return setPreviews([]);
    setBusy(true);
    const processed = await Promise.all(files.map(compressImage));
    const dt = new DataTransfer();
    processed.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
    previews.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    setPreviews(processed.map((f) => ({ url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null, name: f.name })));
    setBusy(false);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPreviews([]);
  }

  return (
    <div>
      <span className="label">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      <label
        className={clsx(
          "flex min-h-[64px] cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-4 text-sm font-semibold transition hover:border-brand hover:bg-brand-soft/40",
          previews.length ? "border-ok/50" : "border-border",
        )}
      >
        {allowPdf ? <FileUp className="h-5 w-5 text-brand" /> : <Camera className="h-5 w-5 text-brand" />}
        <span>{busy ? "Procesando…" : previews.length ? `${previews.length} archivo(s) listo(s) — cambiar` : allowPdf ? "Tomar foto o elegir archivo" : "Tomar fotografía"}</span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={acceptAttr}
          multiple={multiple}
          {...(capture && !allowPdf ? { capture: "environment" as const } : {})}
          className="sr-only"
          onChange={onChange}
        />
      </label>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {previews.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {previews.map((p, i) =>
            p.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p.url} alt={p.name} className="h-20 w-20 rounded-xl border object-cover" />
            ) : (
              <span key={i} className="rounded-lg bg-surface-2 px-2 py-1 text-xs">{p.name}</span>
            ),
          )}
          <button type="button" onClick={clear} className="btn-ghost min-h-0 px-2 py-1 text-xs" aria-label="Quitar">
            <X className="h-4 w-4" /> Quitar
          </button>
        </div>
      )}
    </div>
  );
}
