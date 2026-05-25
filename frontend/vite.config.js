import { defineConfig } from "vite";
import react    from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

const BACKEND_ROUTES = [
  "/auth", "/cuenta", "/sesiones", "/admin",
  "/ingresos", "/ocr", "/reportes", "/qr",
  "/docs", "/openapi.json", "/redoc",
];

export default defineConfig({
  plugins: [react(), basicSsl()],

  server: {
    host:  true,  
    port:  3000,
    https: true,   

    proxy: Object.fromEntries(
      BACKEND_ROUTES.map(route => [
        route,
        {
          target:      process.env.BACKEND_URL || "http://backend:8000",
          changeOrigin: true,
          secure:       false,
          ws:           true,
        },
      ])
    ),
  },
});
