import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Protección de rutas en el edge: toda la app exige sesión, salvo login,
 * endpoints de auth/cron, archivos firmados y recursos PWA.
 * La autorización fina (permisos) se valida además en cada página y acción.
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (token?.disabled) {
      const url = new URL("/login?error=disabled", req.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  },
  { pages: { signIn: "/login" } },
);

export const config = {
  matcher: [
    "/((?!login|api/auth|api/cron|api/files/signed|api/health|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|offline).*)",
  ],
};
