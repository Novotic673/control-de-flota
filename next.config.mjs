/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      // Imágenes/documentos: servidos por la app o por URLs firmadas del bucket S3/R2.
      "img-src 'self' data: blob: https:",
      "frame-src 'self' blob: https:",
      "object-src 'self' blob: https:",
      "connect-src 'self'",
      "font-src 'self' data:",
      "worker-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Las fotos se comprimen en el navegador antes de subir; 5 MB cubre PDFs escaneados.
    serverActions: { bodySizeLimit: "5mb" },
    serverComponentsExternalPackages: ["pg", "@prisma/adapter-pg", "exceljs", "jspdf", "jspdf-autotable"],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Archivos privados: se permiten dentro de la propia app (visor de documentos a pantalla completa).
      {
        source: "/api/files/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'self'" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
