// src/pages/admin/AdminReportes.jsx — Descarga de reportes CSV/Excel
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { admin as adminApi } from "../../services/api";
import { C } from "../../theme";

function ReporteCard({ icon, title, desc, onCsv, onExcel, extra, accentColor }) {
  const [loading, setLoading] = useState(null);
  const [msg,     setMsg]     = useState(null);
  const color = accentColor || C.primary;

  async function descargar(tipo, fn) {
    setLoading(tipo); setMsg(null);
    try { await fn(); setMsg({ ok: true, txt: "Descarga iniciada ✓" }); }
    catch (err) { setMsg({ ok: false, txt: err.message }); }
    finally { setLoading(null); }
  }

  return (
    <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(13,27,53,0.06)" }}>
      {/* Top accent bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
      <div style={{ padding: 24 }}>
        <div style={{ width: 52, height: 52, background: `${color}18`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 14 }}>
          {icon}
        </div>
        <h3 style={{ margin: "0 0 8px", color: C.text, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 16 }}>{title}</h3>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 }}>{desc}</p>

        {extra}

        {msg && (
          <div style={{ background: msg.ok ? C.greenLight : C.redLight, border: `1px solid ${msg.ok ? C.green : C.red}`, color: msg.ok ? C.green : C.red, borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 14 }}>
            {msg.txt}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: loading ? 0.7 : 1 }}
            disabled={!!loading}
            onClick={() => descargar("excel", onExcel)}
          >
            {loading === "excel" ? "Descargando…" : "Excel (.xlsx)"}
          </button>
          <button
            style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: loading ? 0.7 : 1 }}
            disabled={!!loading}
            onClick={() => descargar("csv", onCsv)}
          >
            {loading === "csv" ? "Descargando…" : "CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminReportes() {
  const navigate = useNavigate();
  const [fi, setFi] = useState("");
  const [ff, setFf] = useState("");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Poppins', sans-serif" }}>
      {/* Navbar */}
      <div style={{ background: C.bgNavy, padding: "0 16px", display: "flex", alignItems: "center", height: 54, position: "sticky", top: 0, zIndex: 50, gap: 12 }}>
        <button onClick={() => navigate("/admin")}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", cursor: "pointer", fontSize: 13 }}>
          ← Volver
        </button>
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.2)" }} />
        <div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "#fff", fontSize: 14 }}>Reportes</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>Descarga reportes en formato Excel o CSV</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>

        {/* Hero */}
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: C.text, fontSize: "clamp(20px,3vw,26px)", marginBottom: 6 }}>
            Centro de Reportes
          </h2>
          <p style={{ color: C.muted, fontSize: 14 }}>Descarga los registros del parqueadero en los formatos que necesites</p>
        </div>

        {/* Filtro de fechas */}
        <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: "0 2px 8px rgba(13,27,53,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, background: C.accentLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#7a5800", fontWeight: 800, fontFamily: "'Montserrat',sans-serif" }}>FIL</div>
            <div>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 14, fontFamily: "'Montserrat',sans-serif" }}>Filtro de fechas</div>
              <div style={{ color: C.muted, fontSize: 12 }}>Aplica a reportes de visitas</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={labelS}>Desde</label>
              <input style={inputS} type="date" value={fi} onChange={e => setFi(e.target.value)} />
            </div>
            <div>
              <label style={labelS}>Hasta</label>
              <input style={inputS} type="date" value={ff} onChange={e => setFf(e.target.value)} />
            </div>
            <button
              style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              onClick={() => { setFi(""); setFf(""); }}>
              Limpiar
            </button>
          </div>
          {(fi || ff) && (
            <div style={{ marginTop: 12, background: C.primaryLight, border: `1px solid ${C.primary}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: C.primary, fontWeight: 600 }}>
              Filtro activo: {fi || "inicio"} → {ff || "hoy"}
            </div>
          )}
        </div>

        {/* Cards de reportes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20, marginBottom: 24 }}>
          <ReporteCard
            icon="🚗"
            title="Reporte de Visitas"
            accentColor={C.primary}
            desc="Historial completo de entradas y salidas de vehículos. Incluye placa, usuario, tiempos, cobros y número de factura."
            onExcel={() => adminApi.descargarReporteVisitas("excel", fi || null, ff || null)}
            onCsv={()   => adminApi.descargarReporteVisitas("csv",   fi || null, ff || null)}
          />

          <ReporteCard
            icon="📅"
            title="Reporte de Mensualidades"
            accentColor={C.accent}
            desc="Listado completo de suscripciones mensuales activas, vencidas y pendientes. Incluye usuario, periodo, montos y estado."
            onExcel={() => adminApi.descargarReporteMensualidades("excel")}
            onCsv={()   => adminApi.descargarReporteMensualidades("csv")}
          />
        </div>

        {/* Info formatos */}
        <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(13,27,53,0.05)" }}>
          <h3 style={{ margin: "0 0 16px", color: C.text, fontSize: 14, fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>Sobre los formatos</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, fontSize: 13 }}>
            <div style={{ background: C.greenLight, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ color: C.green, fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Excel (.xlsx)</div>
              <ul style={{ color: C.text, margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                <li>Encabezados con formato</li>
                <li>Compatible con Excel, LibreOffice</li>
                <li>Ideal para análisis y gráficos</li>
              </ul>
            </div>
            <div style={{ background: C.primaryLight, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ color: C.primary, fontWeight: 700, marginBottom: 8, fontSize: 13 }}>CSV</div>
              <ul style={{ color: C.text, margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                <li>Formato universal de texto</li>
                <li>Compatible con cualquier herramienta</li>
                <li>Ideal para importar a otras apps</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelS = { display: "block", color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" };
const inputS = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", fontFamily: "'Poppins',sans-serif" };
