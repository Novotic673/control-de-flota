"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
export function LogoutButton() {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary w-full text-danger">
      <LogOut className="h-4 w-4" /> Cerrar sesión
    </button>
  );
}
