"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Buscador global: patente, marca, modelo, usuario o documento. */
export function SearchBox() {
  const [q, setQ] = useState("");
  const router = useRouter();
  return (
    <form
      className="relative flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim().length >= 2) router.push(`/admin/buscar?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar patente, marca, modelo, usuario, documento…" className="input h-10 py-0 pl-9 sm:py-0" aria-label="Buscar" />
    </form>
  );
}
