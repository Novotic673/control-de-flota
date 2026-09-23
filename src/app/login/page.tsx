import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string; error?: string } }) {
  if (await getSessionUser()) redirect("/");
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-6">
          <h1 className="text-xl font-bold">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted">Gestión de flota vehicular</p>
          <LoginForm callbackUrl={safeCallback(searchParams.callbackUrl)} initialError={searchParams.error === "disabled" ? "Tu cuenta está desactivada." : undefined} />
        </div>
        {demo && (
          <div className="mt-4 rounded-2xl border border-dashed p-4 text-xs text-muted">
            <p className="mb-1 font-semibold text-fg">Cuentas de demostración</p>
            <p>Administrador: <b>admin@novotic.cl</b></p>
            <p>Conductor: <b>rodrigo.catalan@novotic.cl</b></p>
            <p>Contraseña: <b>Novotic2026!</b></p>
          </div>
        )}
      </div>
    </div>
  );
}

function safeCallback(url?: string) {
  // Solo rutas internas (evita redirecciones abiertas).
  if (!url) return "/";
  try {
    const u = new URL(url, "http://x");
    return u.origin === "http://x" && u.pathname.startsWith("/") && !u.pathname.startsWith("//") ? u.pathname + u.search : "/";
  } catch {
    return "/";
  }
}
