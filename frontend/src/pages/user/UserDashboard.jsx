// src/pages/user/UserDashboard.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import { cuenta as cuentaApi, sesiones as sesionesApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { C, S } from "../../theme";

/* ── Navbar ─────────────────────────────────────────────────── */
function Navbar({ user, onLogout }) {
  return (
    <header style={nav.bar}>
      <div style={nav.inner}>
        <div style={nav.brand}>
          <div style={nav.logo}>P</div>
          <div>
            <div style={nav.name}>ParqUni</div>
            <div style={nav.sub}>Portal de Usuario</div>
          </div>
        </div>
        <div style={nav.right}>
          <span style={nav.user}>{user?.nombre}</span>
          <button onClick={onLogout} style={nav.btn}>Cerrar sesión</button>
        </div>
      </div>
    </header>
  );
}

const nav = {
  bar:   { background: C.bgNavy, boxShadow: "0 2px 12px rgba(0,0,0,.2)", fontFamily: "'Poppins',sans-serif" },
  inner: { maxWidth: 900, margin: "0 auto", padding: "0 16px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 56 },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  logo:  { width: 32, height: 32, background: C.accent, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#fff", fontSize: 14, flexShrink: 0 },
  name:  { fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#fff", fontSize: 14 },
  sub:   { fontSize: 10, color: "rgba(255,255,255,.4)" },
  right: { display: "flex", alignItems: "center", gap: 10 },
  user:  { color: "rgba(255,255,255,.65)", fontSize: 12, display: "none" },
  btn:   { background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Poppins',sans-serif" },
};

/* ── Tabs ────────────────────────────────────────────────────── */
function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tab-bar">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          background: "none", border: "none", cursor: "pointer",
          padding: "11px 18px", fontSize: 13, fontWeight: 600,
          fontFamily: "'Poppins',sans-serif", whiteSpace: "nowrap",
          color: active === t.id ? C.primary : C.muted,
          borderBottom: `3px solid ${active === t.id ? C.primary : "transparent"}`,
          marginBottom: -2, transition: "color .2s",
          flexShrink: 0,
        }}>{t.icon && <span style={{ marginRight: 6 }}>{t.icon}</span>}{t.label}</button>
      ))}
    </div>
  );
}

/** Descarga el QR base64 como PNG */
function descargarQRImagen(imagenB64, nombre) {
  const a = document.createElement("a");
  a.href = `data:image/png;base64,${imagenB64}`;
  a.download = `QR_${nombre || "acceso"}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ── Sección: Mi QR ─────────────────────────────────────────── */
function MiQR() {
  const [qrData,    setQrData]   = useState(null);
  const [vehiculo,  setVehiculo] = useState(null);
  const [form,      setForm]     = useState({ placa: "", marca: "", modelo: "", color: "", tipo_vehiculo: "carro" });
  const [editMode,  setEditMode] = useState(false);
  const [tab,       setTab]      = useState("qr");
  const [msg,       setMsg]      = useState(null);
  const [loading,   setLoading]  = useState(false);
  const [resultado, setResultado]= useState(null);
  const [codigo,    setCodigo]   = useState("");
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const [camActiva, setCamActiva]= useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [v, q] = await Promise.all([cuentaApi.vehiculo(), cuentaApi.qr()]);
      setVehiculo(v.vehiculo);
      if (v.vehiculo) setForm({ ...v.vehiculo, tipo_vehiculo: v.vehiculo.tipo_vehiculo || "carro" });
      setQrData(q.qr);
    } catch {}
  }

  async function guardarVehiculo(e) {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      if (vehiculo) { await cuentaApi.actualizarVehiculo(form); }
      else          { await cuentaApi.registrarVehiculo(form); }
      setMsg({ ok: true, txt: "Vehículo guardado correctamente" });
      setEditMode(false);
      await cargar();
    } catch (err) { setMsg({ ok: false, txt: err.message }); }
    finally { setLoading(false); }
  }

  async function generarQR() {
    setLoading(true); setMsg(null);
    try {
      await cuentaApi.generarQR();
      await cargar();
      setMsg({ ok: true, txt: "QR generado correctamente" });
    } catch (err) { setMsg({ ok: false, txt: err.message }); }
    finally { setLoading(false); }
  }

  async function validar(cod) {
    try {
      const r = await sesionesApi.validarQR(cod);
      setResultado(r);
    } catch (err) {
      setResultado({ autorizado: false, motivo: err.message });
    }
  }

  const detenerCamara = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    if (videoRef.current?.srcObject)
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    setCamActiva(false);
  }, []);

  async function iniciarCamara() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCamActiva(true);
    } catch { setMsg({ ok: false, txt: "No se pudo acceder a la cámara" }); }
  }

  useEffect(() => {
    if (!camActiva) return;
    const scan = () => {
      const v = videoRef.current, c = canvasRef.current;
      if (!v || !c || v.readyState < 2) { animRef.current = requestAnimationFrame(scan); return; }
      c.width = v.videoWidth; c.height = v.videoHeight;
      const ctx = c.getContext("2d"); ctx.drawImage(v, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(d.data, d.width, d.height, { inversionAttempts: "attemptBoth" });
      if (code) { detenerCamara(); setCodigo(code.data); validar(code.data); return; }
      animRef.current = requestAnimationFrame(scan);
    };
    animRef.current = requestAnimationFrame(scan);
    return () => { cancelAnimationFrame(animRef.current); detenerCamara(); };
  }, [camActiva, detenerCamara]);

  function procesarImagenQR(file) {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height);
      const code = jsQR(d.data, d.width, d.height, { inversionAttempts: "attemptBoth" });
      if (code) { setCodigo(code.data); validar(code.data); }
      else setMsg({ ok: false, txt: "No se detectó QR en la imagen" });
    };
    img.src = URL.createObjectURL(file);
  }

  return (
    <div>
      <Tabs
        tabs={[{ id: "qr", label: "Mi QR & Vehículo" }, { id: "escanear", label: "Escanear QR" }]}
        active={tab} onChange={t => { setTab(t); setResultado(null); }}
      />

      {msg && <div style={msg.ok ? S.alertOk : S.alertErr}>{msg.txt}</div>}

      {/* Tab QR */}
      {tab === "qr" && (
        <>
          {/* Vehículo */}
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h3 style={cardTitle}>Mi Vehículo</h3>
              {vehiculo && !editMode && (
                <button style={S.btnSecondary} onClick={() => setEditMode(true)}>Editar</button>
              )}
            </div>

            {vehiculo && !editMode ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ background: C.bgNavy, color: "#fff", padding: "10px 20px", borderRadius: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 3, fontFamily: "'Montserrat',sans-serif" }}>{vehiculo.placa}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{vehiculo.tipo_vehiculo === "moto" ? "Motocicleta" : "Carro"}</div>
                </div>
                <div>
                  <div style={{ color: C.muted, fontSize: 13 }}>
                    {[vehiculo.marca, vehiculo.modelo, vehiculo.color].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                  </div>
                  {vehiculo.tipo_vehiculo === "moto" && (
                    <div style={{ marginTop: 6, background: "#fff3e0", color: "#e65100", border: "1px solid #e65100", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, display: "inline-block" }}>
                      Tarifa moto: $50/min · máx $15.000/día
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={guardarVehiculo}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 14 }}>
                  {[["Placa *", "placa", "ABC123"], ["Marca", "marca", "Chevrolet"], ["Modelo", "modelo", "2020"], ["Color", "color", "Blanco"]].map(([l, k, p]) => (
                    <div key={k}>
                      <label style={S.label}>{l}</label>
                      <input style={S.input} required={k === "placa"} placeholder={p}
                        value={form[k] || ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label style={S.label}>Tipo de vehículo *</label>
                    <select style={S.input} value={form.tipo_vehiculo || "carro"}
                      onChange={e => setForm(f => ({ ...f, tipo_vehiculo: e.target.value }))}>
                      <option value="carro">Carro — $100/min</option>
                      <option value="moto">Motocicleta — $50/min</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button style={S.btnPrimary} type="submit" disabled={loading}>
                    {loading ? "Guardando…" : vehiculo ? "Actualizar" : "Registrar vehículo"}
                  </button>
                  {editMode && <button style={S.btnSecondary} type="button" onClick={() => setEditMode(false)}>Cancelar</button>}
                </div>
              </form>
            )}
          </div>

          {/* QR */}
          <div style={{ ...S.card, marginTop: 16 }}>
            <h3 style={cardTitle}>Código QR de Acceso</h3>
            {qrData ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
                <div style={{ padding: 8, background: "#fff", border: `3px solid ${C.border}`, borderRadius: 10, display: "inline-block", flexShrink: 0 }}>
                  <img src={`data:image/png;base64,${qrData.imagen_b64}`} alt="QR"
                    style={{ width: 150, height: 150, display: "block" }} />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Código</div>
                    <div style={{ fontSize: 12, fontFamily: "monospace", color: C.primary, wordBreak: "break-all" }}>{qrData.codigo}</div>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                    Generado: {new Date(qrData.creado_en).toLocaleDateString("es-CO")}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      style={{ ...S.btnPrimary, fontSize: 13 }}
                      onClick={() => descargarQRImagen(qrData.imagen_b64, qrData.codigo)}>
                      Descargar QR
                    </button>
                    <button style={S.btnSecondary} onClick={generarQR} disabled={loading}>
                      Regenerar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📱</div>
                <p style={{ color: C.muted, marginBottom: 16, fontSize: 13 }}>
                  {vehiculo ? "Genera tu QR personal para ingresar al parqueadero." : "Primero registra tu vehículo."}
                </p>
                <button style={S.btnPrimary} onClick={generarQR} disabled={loading || !vehiculo}>
                  {loading ? "Generando…" : "Generar mi QR"}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab Escanear */}
      {tab === "escanear" && (
        <div style={S.card}>
          <h3 style={cardTitle}>Escanear QR — Entrada / Salida</h3>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
            Escanea el QR para registrar entrada. Al salir, escanea nuevamente para registrar la salida y ver tu factura.
          </p>

          {resultado && (
            <div style={{
              background: resultado.autorizado ? C.greenLight : C.redLight,
              border: `1px solid ${resultado.autorizado ? "#a5d6a7" : "#ef9a9a"}`,
              borderRadius: 12, padding: 20, marginBottom: 20,
            }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: resultado.autorizado ? C.green : C.red, marginBottom: 8 }}>
                {resultado.autorizado ? "✅ Autorizado" : "❌ No autorizado"}
              </div>
              <div style={{ color: C.text, fontSize: 14 }}>{resultado.mensaje || resultado.motivo}</div>
              {resultado.accion === "salida" && (
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
                  {[["Placa", resultado.placa], ["Duración", resultado.duracion],
                    ["Total", resultado.valor != null ? `$${resultado.valor?.toLocaleString("es-CO")} COP` : "—"],
                    ["Factura", resultado.factura || "—"]].map(([k, v]) => (
                    <div key={k} style={{ background: "#fff", borderRadius: 8, padding: "8px 12px" }}>
                      <div style={{ fontSize: 11, color: C.muted }}>{k}</div>
                      <div style={{ fontWeight: 700, color: C.text }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
              <button style={{ ...S.btnSecondary, marginTop: 14 }} onClick={() => { setResultado(null); setCodigo(""); }}>
                Nueva lectura
              </button>
            </div>
          )}

          {/* Código manual */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <input style={{ ...S.input, flex: 1, minWidth: 180 }} placeholder="Pegar código QR…"
              value={codigo} onChange={e => setCodigo(e.target.value)} />
            <button style={S.btnPrimary} onClick={() => validar(codigo)} disabled={!codigo}>Validar</button>
          </div>

          {/* Upload */}
          <label style={{ ...S.btnSecondary, display: "block", textAlign: "center", cursor: "pointer", marginBottom: 10 }}>
            Cargar imagen QR
            <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => e.target.files[0] && procesarImagenQR(e.target.files[0])} />
          </label>

          {/* Cámara */}
          {!camActiva ? (
            <button style={S.btnPrimary} onClick={iniciarCamara}>Escanear con cámara</button>
          ) : (
            <div>
              <video ref={videoRef} style={{ width: "100%", borderRadius: 10, background: "#000", maxHeight: 260, objectFit: "cover" }} playsInline />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <button style={{ ...S.btnSecondary, marginTop: 10 }} onClick={detenerCamara}>Detener</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Historial ─────────────────────────────────────────────── */
function Historial() {
  const [items, setItems] = useState([]);
  useEffect(() => { cuentaApi.sesiones().then(setItems).catch(() => {}); }, []);
  return (
    <div style={S.card}>
      <h3 style={cardTitle}>Historial de Visitas</h3>
      {items.length === 0 ? (
        <p style={{ color: C.muted, textAlign: "center", padding: 32 }}>Sin visitas registradas aún.</p>
      ) : (
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
            <thead>
              <tr>{["Placa","Tipo","Entrada","Salida","Duración","Valor","Estado"].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id}>
                  <td style={S.td}><span style={{ fontFamily: "monospace", fontWeight: 700, color: C.primary }}>{s.placa}</span></td>
                  <td style={S.td}><span style={{ ...S.badge, background: C.primaryLight, color: C.primary }}>{s.tipo}</span></td>
                  <td style={S.td}>{new Date(s.entrada_at).toLocaleString("es-CO")}</td>
                  <td style={S.td}>{s.salida_at ? new Date(s.salida_at).toLocaleString("es-CO") : <span style={{ color: C.yellow }}>En curso</span>}</td>
                  <td style={S.td}>{s.duracion ? `${s.duracion} min` : "—"}</td>
                  <td style={S.td}>{s.valor != null ? <strong style={{ color: C.green }}>${s.valor.toLocaleString("es-CO")}</strong> : "—"}</td>
                  <td style={S.td}><span style={{ ...S.badge, background: s.estado === "completada" ? C.greenLight : C.yellowLight, color: s.estado === "completada" ? C.green : C.yellow }}>{s.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Facturas ─────────────────────────────────────────────── */
function Facturas() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState({});
  const [msg,     setMsg]     = useState(null);

  useEffect(() => { cuentaApi.facturas().then(setItems).catch(() => {}); }, []);

  async function descargarPdf(f) {
    setLoading(l => ({ ...l, [f.id]: true }));
    try {
      await cuentaApi.descargarFacturaPdf(f.id, f.numero);
    } catch {
      setMsg("Error al generar el PDF.");
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setLoading(l => ({ ...l, [f.id]: false }));
    }
  }

  return (
    <div style={S.card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ ...cardTitle, margin: 0 }}>Mis Facturas</h3>
        <span style={{ color: C.muted, fontSize: 12 }}>{items.length} facturas</span>
      </div>

      {msg && (
        <div style={S.alertErr}>{msg}</div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🧾</div>
          <p style={{ color: C.muted, fontSize: 14 }}>Sin facturas registradas.</p>
          <p style={{ color: C.muted, fontSize: 12 }}>Las facturas se generan al registrar una salida.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(f => (
            <div key={f.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* Tipo icono */}
              <div style={{ width: 40, height: 40, background: f.tipo === "visita" ? C.primaryLight : C.accentLight, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {f.tipo === "visita" ? "🚗" : "📅"}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 800, color: C.primary, fontSize: 13 }}>{f.numero}</span>
                  <span style={{ ...S.badge, background: f.tipo === "visita" ? C.primaryLight : C.accentLight, color: f.tipo === "visita" ? C.primary : "#7a5800", fontSize: 10 }}>{f.tipo}</span>
                  <span style={{ ...S.badge, background: f.estado === "pagada" ? C.greenLight : C.redLight, color: f.estado === "pagada" ? C.green : C.red, fontSize: 10 }}>{f.estado}</span>
                </div>
                <div style={{ color: C.muted, fontSize: 11 }}>
                  {f.descripcion?.slice(0, 55)}{f.descripcion?.length > 55 ? "…" : ""}
                </div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>
                  {new Date(f.fecha_emision).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>

              {/* Monto */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 800, color: C.green, fontSize: 16 }}>${f.monto?.toLocaleString("es-CO")}</div>
                <div style={{ color: C.muted, fontSize: 11 }}>COP</div>
              </div>

              {/* PDF */}
              <button
                onClick={() => descargarPdf(f)}
                disabled={loading[f.id]}
                style={{ background: loading[f.id] ? C.border : C.primary, color: "#fff", border: "none", borderRadius: 7, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: loading[f.id] ? "default" : "pointer", flexShrink: 0 }}>
                {loading[f.id] ? "…" : "PDF"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Dashboard ────────────────────────────────────────────── */
export default function UserDashboard() {
  const [tab, setTab] = useState("qr");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  function handleLogout() { logout(); navigate("/usuario/login"); }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Poppins',sans-serif" }}>
      <Navbar user={user} onLogout={handleLogout} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 14px" }}>
        {/* Welcome */}
        <div style={{ background: "linear-gradient(135deg,#0d1b35,#1a2e5a)", borderRadius: 12, padding: "18px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#fff", fontSize: "clamp(15px,3vw,18px)" }}>
              Hola, {user?.nombre?.split(" ")[0]} 👋
            </div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 2 }}>
              Gestiona tu vehículo y acceso al parqueadero Unimonserrate
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600 }}>Portal de Usuario</div>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: "qr",        label: "Mi QR & Vehículo" },
            { id: "historial", label: "Historial" },
            { id: "facturas",  label: "Facturas" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "qr"        && <MiQR />}
        {tab === "historial" && <Historial />}
        {tab === "facturas"  && <Facturas />}
      </div>
    </div>
  );
}

const cardTitle = { color: C.text, fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 14, fontFamily: "'Montserrat',sans-serif" };
