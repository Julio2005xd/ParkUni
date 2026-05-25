// src/services/api.js — Capa de acceso a la API FastAPI v2

// Con VITE_API_URL vacío (proxy Vite), todas las llamadas son relativas al origen
// → https://192.168.2.7:3000/auth/login  → Vite proxy → http://backend:8000/auth/login
// Así la cámara funciona en HTTP desde cualquier dispositivo en la red.
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

function getToken() {
  return localStorage.getItem("parq_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res  = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Error en la petición");
  return data;
}

async function requestFile(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Error al descargar archivo");
  }
  return res;
}

// ─── Auth ────────────────────────────────────────────────────────
export const auth = {
  login:     (correo, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ correo, password }) }),

  registrar: (datos) =>
    request("/auth/registrar", { method: "POST", body: JSON.stringify(datos) }),

  me: () => request("/auth/me"),
};

// ─── Mi Cuenta (usuario autenticado) ─────────────────────────────
export const cuenta = {
  perfil:           () => request("/cuenta/perfil"),
  actualizarPerfil: (datos) => request("/cuenta/perfil", { method: "PUT", body: JSON.stringify(datos) }),

  vehiculo:         () => request("/cuenta/vehiculo"),
  registrarVehiculo: (datos) =>
    request("/cuenta/vehiculo", { method: "POST", body: JSON.stringify(datos) }),
  actualizarVehiculo: (datos) =>
    request("/cuenta/vehiculo", { method: "PUT", body: JSON.stringify(datos) }),

  qr:          () => request("/cuenta/qr"),
  generarQR:   () => request("/cuenta/qr/generar", { method: "POST" }),

  sesiones: (skip = 0, limit = 50) =>
    request(`/cuenta/sesiones?skip=${skip}&limit=${limit}`),
  facturas: (skip = 0, limit = 50) =>
    request(`/cuenta/facturas?skip=${skip}&limit=${limit}`),

  descargarFacturaPdf: async (facturaId, numero) => {
    const res  = await requestFile(`/cuenta/facturas/${facturaId}/pdf`);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Factura_${numero || facturaId}.pdf`;
    a.click();
  },
};

// ─── Sesiones (público) ───────────────────────────────────────────
export const sesiones = {
  validarQR:     (codigo) =>
    request("/sesiones/validar-qr", { method: "POST", body: JSON.stringify({ codigo }) }),

  camaraPlaca:   (placa) =>
    request("/sesiones/camara-placa", { method: "POST", body: JSON.stringify({ placa }) }),

  activas:       () => request("/sesiones/activas"),
  historial:     (skip = 0, limit = 100) =>
    request(`/sesiones/historial?skip=${skip}&limit=${limit}`),
};

// ─── Admin ───────────────────────────────────────────────────────
export const admin = {
  dashboard: () => request("/admin/dashboard"),

  // Cuentas
  listarCuentas: () => request("/admin/cuentas"),
  crearCuenta:   (datos) =>
    request("/admin/cuentas", { method: "POST", body: JSON.stringify(datos) }),
  toggleCuenta:  (id) =>
    request(`/admin/cuentas/${id}/toggle`, { method: "PUT" }),

  // Mensualidades
  listarMensualidades: () => request("/admin/mensualidades"),
  crearMensualidad:    (datos) =>
    request("/admin/mensualidades", { method: "POST", body: JSON.stringify(datos) }),
  generarQRMensualidad: (mensId) =>
    request(`/admin/mensualidades/${mensId}/generar-qr`, { method: "POST" }),
  cambiarEstadoMensualidad: (mensId, estado) =>
    request(`/admin/mensualidades/${mensId}/estado`, {
      method: "PUT", body: JSON.stringify({ estado }),
    }),
  eliminarMensualidad: (mensId) =>
    request(`/admin/mensualidades/${mensId}`, { method: "DELETE" }),

  // Reportes descarga
  descargarReporteVisitas: async (formato = "excel", fi = null, ff = null) => {
    let url = `/admin/reportes/visitas?formato=${formato}`;
    if (fi) url += `&fecha_inicio=${fi}`;
    if (ff) url += `&fecha_fin=${ff}`;
    const res = await requestFile(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reporte_visitas.${formato === "excel" ? "xlsx" : "csv"}`;
    a.click();
  },

  descargarReporteMensualidades: async (formato = "excel") => {
    const res  = await requestFile(`/admin/reportes/mensualidades?formato=${formato}`);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reporte_mensualidades.${formato === "excel" ? "xlsx" : "csv"}`;
    a.click();
  },

  // Email
  enviarAlerta: (cuenta_id, asunto, mensaje) =>
    request("/admin/email/alerta", {
      method: "POST",
      body: JSON.stringify({ cuenta_id, asunto, mensaje }),
    }),

  // Facturas PDF
  descargarFacturaPdf: async (facturaId, numero) => {
    const res  = await requestFile(`/admin/facturas/${facturaId}/pdf`);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Factura_${numero || facturaId}.pdf`;
    a.click();
  },

  reenviarFactura: (facturaId) =>
    request(`/admin/facturas/${facturaId}/reenviar`, { method: "POST" }),
};

// ─── Legacy (compatibilidad) ──────────────────────────────────────
export const reportes = {
  resumen:     () => request("/reportes/resumen"),
  ingresosDia: () => request("/reportes/ingresos-dia"),
  recaudoDia:  () => request("/reportes/recaudo-dia"),
};

export const ingresos = {
  activos:   () => request("/ingresos/activos"),
  historial: (skip = 0, limit = 100) =>
    request(`/ingresos/historial?skip=${skip}&limit=${limit}`),
  ocupacion: () => request("/ingresos/ocupacion"),

  detectarPlaca: async (imagenFile) => {
    const form = new FormData();
    form.append("imagen", imagenFile);
    const token = getToken();
    const res   = await fetch(`${BASE_URL}/ocr/detectar-placa`, {
      method: "POST", body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.json();
  },

  decodificarQR: async (imagenFile) => {
    const form = new FormData();
    form.append("imagen", imagenFile);
    const token = getToken();
    const res   = await fetch(`${BASE_URL}/qr/decodificar`, {
      method: "POST", body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.json();
  },
};