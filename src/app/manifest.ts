import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Novotic Fleet",
    short_name: "Fleet",
    description: "Gestión de flota vehicular: reservas, retiro, devolución, documentos y mantenciones.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f9",
    theme_color: "#124cc2",
    lang: "es-CL",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Reservar", url: "/reservar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Mis reservas", url: "/reservas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Alertas", url: "/alertas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
