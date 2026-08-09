import "./globals.css";
import { AppProvider } from "../context/AppProvider";

export const metadata = {
  title: "Turapp - Viajes a Cali",
  description: "Plataforma de transporte y reservas premium",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="tr-app">
          <div id="iphone-wrapper">
            <div id="iphone-wrapper-content" style={{ width: '100%', height: '100%', position: 'relative' }}>
              <AppProvider>
                {children}
              </AppProvider>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
