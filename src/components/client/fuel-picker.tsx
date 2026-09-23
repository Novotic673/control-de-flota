"use client";

import { useState } from "react";
import clsx from "clsx";
import { Fuel } from "lucide-react";

const LEVELS = [0, 25, 50, 75, 100];
const LABEL: Record<number, string> = { 0: "Reserva", 25: "1/4", 50: "1/2", 75: "3/4", 100: "Lleno" };

export function FuelPicker({ name, defaultValue = 75, label = "Nivel de combustible" }: { name: string; defaultValue?: number; label?: string }) {
  const [v, setV] = useState(defaultValue);
  return (
    <div>
      <span className="label flex items-center gap-1.5"><Fuel className="h-4 w-4" /> {label}: <b>{v}%</b></span>
      <input type="hidden" name={name} value={v} />
      <div className="grid grid-cols-5 gap-1.5">
        {LEVELS.map((l) => (
          <button
            type="button"
            key={l}
            onClick={() => setV(l)}
            className={clsx("min-h-[48px] rounded-xl border text-sm font-bold transition", v === l ? "border-brand bg-brand text-brand-fg" : "bg-surface text-muted")}
          >
            {LABEL[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
