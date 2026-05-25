// src/pages/admin/AdminMensualidades.jsx — Gestión de mensualidades
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { admin as adminApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { C, S } from "../../theme";

function estadoBadge(estado) {
  const map = {
    activa:    { background: C.greenLight,  color: C.green,   border: `1px solid ${C.green}` },
    vencida:   { background: C.redLight,    color: C.red,     border: `1px solid ${C.red}` },
    pendiente: { background: C.yellowLight, color: C.yellow,  border: `1px solid ${C.yellow}` },
    cancelada: { background: "#f3eeff",     color: "#7c3aed", border: "1px solid #7c3aed" },
  };
  const s = map[estado] || { background: C.primaryLight, color: C.primary, border: `1px solid ${C.primary}` };
  return { display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, ...s };
}

function vehiculoBadge(tipo) {
  return tipo === "moto"
    ? { background: "#fff3e0", color: "#e65100", border: "1px solid #e65100", display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }
    : { background: C.primaryLight, color: C.primary, border: `1px solid ${C.primary}`, display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 };
}

function descargarQR(imagenB64, nombre) {
  const a = document.createElement("a");
  a.href = `data:image/png;base64,${imagenB64}`;
  a.download = `QR_${nombre || "mensualidad"}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function AdminMensualidades() {
  const [mens,     setMens]     = useState([]);
  const [cuentas,  setCuentas]  = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [qrModal,  setQrModal]  = useState(null);
  const [msg,      setMsg]      = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [form, setForm] = useState({
    cuenta_id: "", periodo: "", fecha_inicio: "", fecha_fin: "", monto: "80000",
  });
  const { logout } = useAuth();
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([adminApi.listarMensualidades(), adminApi.listarCuentas()]);
      setMens(m);
      setCuentas(c.filter(x => x.rol === "usuario"));
    } catch {}
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function crearMensualidad(e) {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      await adminApi.crearMensualidad({
        ...form,
        cuenta_id: parseInt(form.cuenta_id),
        monto: parseFloat(form.monto),
      });
      setMsg({ ok: true, txt: "Mensualidad creada correctamente" });
      setShowForm(false);
      setForm({ cuenta_id: "", periodo: "", fecha_inicio: "", fecha_fin: "", monto: "80000" });
      cargar();
    } catch (err) {
      setMsg({ ok: false, txt: err.message });
    } finally { setLoading(false); }
  }

  async function generarQR(mensId, usuario) {
    try {
      const r = await adminApi.generarQRMensualidad(mensId);
      setQrModal({ ...r, usuario });
      cargar();
    } catch (err) {
      setMsg({ ok: false, txt: err.message });
    }
  }

  async function cambiarEstado(mensId, estado) {
    try {
      await adminApi.cambiarEstadoMensualidad(mensId, estado);
      cargar();
    } catch (err) {
      setMsg({ ok: false, txt: err.message });
    }
  }

  async function eliminar(mensId) {
    if (!confirm("¿Cancelar esta mensualidad?")) return;
    try {
      await adminApi.eliminarMensualidad(mensId);
      cargar();
    } catch (err) {
      setMsg({ ok: false, txt: err.message });
    }
  }

  function handlePeriodoChange(p) {
    setForm(f => {
      const ini = p ? `${p}-01` : "";
      let fin = "";
      if (p) {
        const [y, m] = p.split("-").map(Number);
        const ultimo = new Date(y, m, 0).getDate();
        fin = `${p}-${String(ultimo).padStart(2, "0")}`;
      }
      return { ...f, periodo: p, fecha_inicio: ini, fecha_fin: fin };
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ background: C.bgNavy, padding: "0 16px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 54, position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/admin")}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", cursor: "pointer", fontSize: 13, padding: "4px 0" }}>
            ← Volver
          </button>
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.2)" }} />
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "#fff", fontSize: 14 }}>Mensualidades</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>Gestión de suscripciones — sin cobro por visita</div>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
          + Nueva mensualidad
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        {msg && (
          <div style={{ background: msg.ok ? C.greenLight : C.redLight, border: `1px solid ${msg.ok ? C.green : C.red}`, color: msg.ok ? C.green : C.red, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
            {msg.txt}
          </div>
        )}

        {showForm && (
          <form onSubmit={crearMensualidad} style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: "0 2px 12px rgba(13,27,53,0.07)" }}>
            <h3 style={{ margin: "0 0 18px", color: C.text, fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>Nueva Mensualidad</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ flex: "1 1 220px" }}>
                <label style={labelS}>Usuario *</label>
                <select style={inputS} required value={form.cuenta_id}
                  onChange={e => setForm(f => ({ ...f, cuenta_id: e.target.value }))}>
                  <option value="">Seleccionar usuario…</option>
                  {cuentas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} — {c.correo}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: "0 0 150px" }}>
                <label style={labelS}>Periodo *</label>
                <input style={inputS} type="month" required value={form.periodo}
                  onChange={e => handlePeriodoChange(e.target.value)} />
              </div>

              <div style={{ flex: "0 0 160px" }}>
                <label style={labelS}>Inicio *</label>
                <input style={inputS} type="date" required value={form.fecha_inicio}
                  onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>

              <div style={{ flex: "0 0 160px" }}>
                <label style={labelS}>Fin *</label>
                <input style={inputS} type="date" required value={form.fecha_fin}
                  onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
              </div>

              <div style={{ flex: "0 0 140px" }}>
                <label style={labelS}>Monto (COP) *</label>
                <input style={inputS} type="number" required min="0" value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                type="submit" disabled={loading}>
                {loading ? "Creando…" : "Crear mensualidad"}
              </button>
              <button style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13 }}
                type="button" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {qrModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ background: C.bgWhite, borderRadius: 16, padding: 32, maxWidth: 380, width: "90%", textAlign: "center", boxShadow: "0 8px 32px rgba(13,27,53,0.2)" }}>
              <div style={{ width: 48, height: 48, background: C.primaryLight, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, margin: "0 auto 16px", color: C.primary, fontWeight: 800, fontFamily: "'Montserrat',sans-serif" }}>QR</div>
              <h3 style={{ color: C.text, marginTop: 0, fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>QR de Mensualidad</h3>
              <div style={{ background: C.bg, borderRadius: 12, padding: 16, display: "inline-block", marginBottom: 12 }}>
                <img src={`data:image/png;base64,${qrModal.imagen_b64}`} alt="QR mensualidad"
                  style={{ width: 180, height: 180, borderRadius: 8, display: "block" }} />
              </div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4, fontFamily: "monospace", background: C.bg, padding: "4px 10px", borderRadius: 6, display: "inline-block" }}>
                {qrModal.codigo}
              </div>
              <p style={{ color: C.muted, fontSize: 12, marginTop: 12, marginBottom: 16 }}>
                Entrega este QR al usuario para que acceda con su mensualidad activa.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                  onClick={() => descargarQR(qrModal.imagen_b64, qrModal.usuario)}>
                  Descargar QR
                </button>
                <button style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                  onClick={() => setQrModal(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px", fontSize: 12, color: C.muted, flex: "0 0 auto" }}>
            <strong style={{ color: C.text }}>Mensualidades</strong> — Los usuarios con mensualidad activa entran y salen sin cobro por tiempo. Solo se registran los accesos.
          </div>
          <div style={{ background: "#fff3e0", border: "1px solid #e65100", borderRadius: 10, padding: "10px 16px", fontSize: 12, color: "#bf360c", flex: "0 0 auto" }}>
            <strong>Moto:</strong> $50/min · tope $15.000/día &nbsp;|&nbsp; <strong>Carro:</strong> $100/min · tope $30.000/día (visitas)
          </div>
        </div>

        <div style={{ background: C.bgWhite, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, boxShadow: "0 2px 12px rgba(13,27,53,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", color: C.text, fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>Mensualidades registradas</h3>
          {mens.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 36, marginBottom: 12, color: C.muted }}>○</div>
              <p style={{ color: C.muted, fontSize: 14 }}>Sin mensualidades registradas</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Usuario", "Periodo", "Vehículo", "Estado", "Entradas", "Salidas", "Monto", "QR", "Acciones"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: C.muted, borderBottom: `2px solid ${C.border}`, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mens.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={td}>
                        <strong style={{ color: C.text }}>{m.usuario}</strong>
                        <div style={{ color: C.muted, fontSize: 11 }}>{m.correo}</div>
                      </td>
                      <td style={td}>
                        <span style={{ fontFamily: "monospace", color: C.accent, fontWeight: 700 }}>{m.periodo}</span>
                        <div style={{ color: C.muted, fontSize: 10 }}>{m.fecha_inicio} → {m.fecha_fin}</div>
                      </td>
                      <td style={td}>
                        <span style={vehiculoBadge(m.tipo_vehiculo)}>
                          {m.tipo_vehiculo === "moto" ? "Moto" : "Carro"}
                        </span>
                      </td>
                      <td style={td}><span style={estadoBadge(m.estado)}>{m.estado}</span></td>
                      <td style={td}>
                        <span style={{ fontWeight: 700, color: C.green, fontSize: 15 }}>{m.total_entradas ?? 0}</span>
                        <div style={{ color: C.muted, fontSize: 10 }}>entradas</div>
                      </td>
                      <td style={td}>
                        <span style={{ fontWeight: 700, color: C.primary, fontSize: 15 }}>{m.total_salidas ?? 0}</span>
                        <div style={{ color: C.muted, fontSize: 10 }}>salidas</div>
                      </td>
                      <td style={td}><strong style={{ color: C.green }}>${parseFloat(m.monto).toLocaleString("es-CO")}</strong></td>
                      <td style={td}>
                        {m.tiene_qr ? (
                          <button onClick={() => generarQR(m.id, m.usuario)}
                            style={{ background: C.primaryLight, color: C.primary, border: `1px solid ${C.primary}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            Ver / Descargar QR
                          </button>
                        ) : (
                          <button onClick={() => generarQR(m.id, m.usuario)}
                            style={{ background: C.green, color: "#fff", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            + Generar QR
                          </button>
                        )}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
                          {m.estado !== "activa" && (
                            <button onClick={() => cambiarEstado(m.id, "activa")}
                              style={{ background: C.greenLight, color: C.green, border: `1px solid ${C.green}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                              Activar
                            </button>
                          )}
                          {m.estado === "activa" && (
                            <button onClick={() => cambiarEstado(m.id, "vencida")}
                              style={{ background: C.yellowLight, color: C.yellow, border: `1px solid ${C.yellow}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                              Vencer
                            </button>
                          )}
                          <button onClick={() => eliminar(m.id)}
                            style={{ background: C.redLight, color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                            X
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const td     = { padding: "10px 12px", color: C.text, verticalAlign: "middle" };
const labelS = { display: "block", color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" };
const inputS = { width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "'Poppins',sans-serif" };
