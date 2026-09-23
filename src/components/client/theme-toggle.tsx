"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ withLabel }: { withLabel?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }
  return (
    <button type="button" onClick={toggle} className={withLabel ? "btn-secondary w-full justify-start" : "btn-ghost min-h-[40px] px-2.5"} aria-label="Cambiar tema">
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      {withLabel && <span>{dark ? "Modo claro" : "Modo oscuro"}</span>}
    </button>
  );
}
