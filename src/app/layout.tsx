import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/client/toast";
import { SwRegister } from "@/components/client/sw-register";

export const metadata: Metadata = {
  title: { default: "Novotic Fleet", template: "%s · Novotic Fleet" },
  description: "Gestión integral de la flota de vehículos de Novotic",
  applicationName: "Novotic Fleet",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Novotic Fleet", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e16" },
  ],
};

// Aplica el tema antes del primer pintado (sin parpadeo).
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <SwRegister />
      </body>
    </html>
  );
}
