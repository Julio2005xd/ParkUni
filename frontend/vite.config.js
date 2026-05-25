// vite.config.js
import { defineConfig } from "vite";
import react    from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Rutas que pertenecen al backend FastAPI
const BACKEND_ROUTES = [
  "/auth", "/cuenta", "/sesiones", "/admin",
  "/ingresos", "/ocr", "/reportes", "/qr",
  "/docs", "/openapi.json", "/redoc",
];

export default defineConfig({
  plugins: [react(), basicSsl()],

  server: {
    host:  true,   // 0.0.0.0 — accesible desde red local
    port:  3000,
    https: true,   // certificado auto-firmado generado por basicSsl

    proxy: Object.fromEntries(
      BACKEND_ROUTES.map(route => [
        route,
        {
          // "backend" = nombre del servicio Docker (DNS interno)
          // Fallback a localhost para desarrollo local sin Docker
          target:      process.env.BACKEND_URL || "http://backend:8000",
          changeOrigin: true,
          secure:       false,
          ws:           true,
        },
      ])
    ),
  },
});
