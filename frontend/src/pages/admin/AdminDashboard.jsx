// src/pages/admin/AdminDashboard.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { admin as adminApi, sesiones as sesionesApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { C, S } from "../../theme";

/* ── Sidebar ─────────────────────────────────────────────────── */
function AdminSidebar({ tab, setTab, onLogout, sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();

  const navItems = [
    { section: "PANEL" },
    { id: "inicio",    icon: "▣",  label: "Dashboard" },
    { id: "activos",   icon: "◉",  label: "En vivo" },
    { id: "historial", icon: "≡",  label: "Historial" },
    { id: "cuentas",   icon: "⊞",  label: "Cuentas" },
    { section: "GESTIÓN" },
    { id: "mensualidades", icon: "◷", label: "Mensualidades", route: "/admin/mensualidades" },
    { id: "reportes",      icon: "↓", label: "Reportes",       route: "/admin/reportes" },
    { id: "camara",        icon: "⊙", label: "Cámara OCR",     route: "/camara" },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className={`admin-sidebar-overlay${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`admin-sidebar${sidebarOpen ? " open" : ""}`}>
        {/* Brand */}
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logo">P</div>
          <div>
            <div className="admin-sidebar-name">ParqUni</div>
            <div className="admin-sidebar-sub">Administración</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="admin-sidebar-nav">
          {navItems.map((item, i) => {
            if (item.section) {
              return (
                <div key={i} className="admin-nav-section">{item.section}</div>
              );
            }
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                className={`admin-nav-item${isActive ? " active" : ""}`}
                onClick={() => {
                  if (item.route) {
                    navigate(item.route);
                  } else {
                    setTab(item.id);
                    setSidebarOpen(false);
                  }
                }}
              >
                <span className="admin-nav-icon">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="admin-sidebar-footer">
          <button className="admin-sidebar-logout" onClick={onLogout}>
            <span>↩</span> Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

/* ── Stat card ────────────────────────────────────────────────── */
function StatCard({ label, value, icon, color, note }) {
  const colorMap = { blue: C.primary, green: C.green, yellow: C.accent, red: C.red };
  const col = colorMap[color] || C.primary;
  const bgMap = { blue: C.primaryLight, green: C.greenLight, yellow: C.accentLight, red: C.redLight };
  const bg = bgMap[color] || C.primaryLight;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", flex: "1 1 160px", boxShadow: S.card.boxShadow, position: "relative", overflow: "hidden", minWidth: 0 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: col, borderRadius: "12px 12px 0 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ fontSize: 26, background: bg, width: 46, height: 46, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      </div>
      <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 26, color: col }}>{value}</div>
      <div style={{ fontWeight: 600, color: C.text, fontSize: 13, marginTop: 4 }}>{label}</div>
      {note && <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{note}</div>}
    </div>
  );
}

/* ── Sesiones activas ─────────────────────────────────────────── */
function SesionesActivas() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const cargar = useCallback(async () => {
    setLoading(true);
    try { setItems(await sesionesApi.activas()); }
    catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { cargar(); const i = setInterval(cargar, 30000); return () => clearInterval(i); }, [cargar]);

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h3 style={ct}>Vehículos en parqueadero</h3>
        <button onClick={cargar} style={S.btnSecondary}>↻ {loading ? "…" : "Actualizar"}</button>
      </div>
      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, color: C.muted }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🅿</div>
          <div>Sin vehículos en este momento</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
            <thead><tr>{["Placa","Usuario","Tipo","Entrada","Tiempo","Cobro actual"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id}>
                  <td style={S.td}><span style={{ fontFamily: "monospace", fontWeight: 800, color: C.primary, fontSize: 14 }}>{s.placa}</span></td>
                  <td style={S.td}>{s.usuario}</td>
                  <td style={S.td}><span style={{ ...S.badge, background: s.tipo === "mensualidad" ? C.greenLight : C.primaryLight, color: s.tipo === "mensualidad" ? C.green : C.primary }}>{s.tipo}</span></td>
                  <td style={S.td}>{new Date(s.entrada).toLocaleTimeString("es-CO")}</td>
                  <td style={S.td}>{s.minutos} min</td>
                  <td style={S.td}><strong style={{ color: C.green }}>${s.cobro_actual?.toLocaleString("es-CO")}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Historial ─────────────────────────────────────────────────── */
function HistorialAdmin() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState({});
  const [msg,     setMsg]     = useState(null);

  useEffect(() => { sesionesApi.historial(0, 50).then(setItems).catch(() => {}); }, []);

  async function descargarPdf(facturaId, numero) {
    if (!facturaId) return;
    setLoading(l => ({ ...l, [facturaId]: "pdf" }));
    try {
      await adminApi.descargarFacturaPdf(facturaId, numero);
    } catch { setMsg("Error al generar PDF"); setTimeout(() => setMsg(null), 3000); }
    finally { setLoading(l => ({ ...l, [facturaId]: null })); }
  }

  async function reenviar(facturaId) {
    if (!facturaId) return;
    setLoading(l => ({ ...l, [facturaId]: "email" }));
    try {
      const r = await adminApi.reenviarFactura(facturaId);
      setMsg(r.enviado ? `Enviado a ${r.correo}` : "SMTP no configurado");
      setTimeout(() => setMsg(null), 4000);
    } catch { setMsg("Error al reenviar"); setTimeout(() => setMsg(null), 3000); }
    finally { setLoading(l => ({ ...l, [facturaId]: null })); }
  }

  return (
    <div style={S.card}>
      <h3 style={ct}>Historial de sesiones</h3>
      {msg && (
        <div style={{ background: C.primaryLight, border: `1px solid ${C.primary}`, color: C.primary, borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
          {msg}
        </div>
      )}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead><tr>{["Placa","Usuario","Tipo","Entrada","Salida","Duración","Valor","Estado","Factura"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={S.td}><span style={{ fontFamily: "monospace", fontWeight: 800, color: C.primary }}>{s.placa}</span></td>
                <td style={S.td}>{s.usuario}</td>
                <td style={S.td}>{s.tipo}</td>
                <td style={S.td}>{new Date(s.entrada).toLocaleString("es-CO")}</td>
                <td style={S.td}>{s.salida ? new Date(s.salida).toLocaleString("es-CO") : <span style={{ color: C.yellow, fontWeight: 600 }}>Activa</span>}</td>
                <td style={S.td}>{s.duracion ? `${s.duracion} min` : "—"}</td>
                <td style={S.td}>{s.valor != null ? <strong style={{ color: C.green }}>${s.valor?.toLocaleString("es-CO")}</strong> : "—"}</td>
                <td style={S.td}><span style={{ ...S.badge, background: s.estado === "completada" ? C.greenLight : C.yellowLight, color: s.estado === "completada" ? C.green : C.yellow }}>{s.estado}</span></td>
                <td style={S.td}>
                  {s.factura_id ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => descargarPdf(s.factura_id, s.factura_numero)}
                        disabled={!!loading[s.factura_id]}
                        title="Descargar PDF"
                        style={{ background: C.primaryLight, color: C.primary, border: `1px solid ${C.primary}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                        {loading[s.factura_id] === "pdf" ? "…" : "PDF"}
                      </button>
                      <button
                        onClick={() => reenviar(s.factura_id)}
                        disabled={!!loading[s.factura_id]}
                        title="Reenviar por email"
                        style={{ background: C.greenLight, color: C.green, border: `1px solid ${C.green}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                        {loading[s.factura_id] === "email" ? "…" : "✉"}
                      </button>
                    </div>
                  ) : <span style={{ color: C.muted, fontSize: 11 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Gestión de cuentas ───────────────────────────────────────── */
function GestionCuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [form, setForm]       = useState({ nombre: "", correo: "", password: "", documento: "", rol: "usuario" });
  const [msg,  setMsg]        = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [alertaFor, setAlertaFor] = useState(null);
  const [alertaMsg, setAlertaMsg] = useState({ asunto: "", mensaje: "" });

  const cargar = useCallback(() => { adminApi.listarCuentas().then(setCuentas).catch(() => {}); }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function crearCuenta(e) {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      await adminApi.crearCuenta(form);
      setMsg({ ok: true, txt: "Cuenta creada correctamente" });
      setShowForm(false);
      setForm({ nombre: "", correo: "", password: "", documento: "", rol: "usuario" });
      cargar();
    } catch (err) { setMsg({ ok: false, txt: err.message }); }
    finally { setLoading(false); }
  }

  async function toggleCuenta(id) {
    try { await adminApi.toggleCuenta(id); cargar(); }
    catch (err) { setMsg({ ok: false, txt: err.message }); }
  }

  async function enviarAlerta(e) {
    e.preventDefault();
    try {
      const r = await adminApi.enviarAlerta(alertaFor, alertaMsg.asunto, alertaMsg.mensaje);
      if (r.enviado) {
        setMsg({ ok: true, txt: `Correo enviado a ${r.correo}` });
      } else {
        setMsg({ ok: false, txt: `SMTP no configurado. Configura SMTP_HOST y SMTP_USER en docker-compose.yml.` });
      }
      setAlertaFor(null);
    } catch (err) { setMsg({ ok: false, txt: err.message }); }
  }

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h3 style={ct}>Cuentas de usuario</h3>
        <button onClick={() => setShowForm(!showForm)} style={S.btnPrimary}>+ Nueva cuenta</button>
      </div>

      {msg && <div style={msg.ok ? S.alertOk : S.alertErr}>{msg.txt}</div>}

      {showForm && (
        <form onSubmit={crearCuenta} style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 16, border: `1px solid ${C.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 14 }}>
            {[["Nombre *","nombre","text"],["Correo *","correo","email"],["Contraseña *","password","password"],["Documento","documento","text"]].map(([l,k,t]) => (
              <div key={k}>
                <label style={S.label}>{l}</label>
                <input style={S.input} type={t} required={l.includes("*")} value={form[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={S.label}>Rol</label>
              <select style={S.input} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                <option value="usuario">Usuario</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={S.btnPrimary} type="submit" disabled={loading}>{loading ? "Creando…" : "Crear cuenta"}</button>
            <button style={S.btnSecondary} type="button" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Modal alerta */}
      {alertaFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,53,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
          <form onSubmit={enviarAlerta} style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <h4 style={{ margin: "0 0 16px", color: C.text, fontFamily: "'Montserrat',sans-serif" }}>Enviar alerta por correo</h4>
            <label style={S.label}>Asunto *</label>
            <input style={S.input} required value={alertaMsg.asunto} onChange={e => setAlertaMsg(m => ({ ...m, asunto: e.target.value }))} />
            <div style={{ marginBottom: 12 }} />
            <label style={S.label}>Mensaje *</label>
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 80 }} required value={alertaMsg.mensaje} onChange={e => setAlertaMsg(m => ({ ...m, mensaje: e.target.value }))} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={S.btnPrimary} type="submit">Enviar</button>
              <button style={S.btnSecondary} type="button" onClick={() => setAlertaFor(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead><tr>{["Nombre","Correo","Documento","Rol","Vehículo","Estado","Acciones"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {cuentas.map(c => (
              <tr key={c.id}>
                <td style={S.td}><strong>{c.nombre}</strong></td>
                <td style={S.td}><span style={{ color: C.primary }}>{c.correo}</span></td>
                <td style={S.td}>{c.documento || "—"}</td>
                <td style={S.td}><span style={{ ...S.badge, background: c.rol === "admin" ? C.accentLight : C.primaryLight, color: c.rol === "admin" ? "#7a5800" : C.primary }}>{c.rol}</span></td>
                <td style={S.td}>{c.vehiculo ? <span style={{ fontFamily: "monospace", fontWeight: 700, color: C.green }}>{c.vehiculo.placa}</span> : <span style={{ color: C.muted }}>—</span>}</td>
                <td style={S.td}><span style={{ color: c.activo ? C.green : C.red, fontWeight: 600 }}>{c.activo ? "Activo" : "Inactivo"}</span></td>
                <td style={S.td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => toggleCuenta(c.id)} style={{ ...S.btnSecondary, padding: "3px 10px", fontSize: 11 }}>
                      {c.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button onClick={() => { setAlertaFor(c.id); setAlertaMsg({ asunto: "", mensaje: "" }); }} style={{ ...S.btnSecondary, padding: "3px 10px", fontSize: 11 }}>
                      Alerta
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── AdminDashboard ───────────────────────────────────────────── */
export default function AdminDashboard() {
  const [tab, setTab]       = useState("inicio");
  const [stats, setStats]   = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout }    = useAuth();
  const navigate = useNavigate();

  useEffect(() => { adminApi.dashboard().then(setStats).catch(() => {}); }, []);
  function handleLogout() { logout(); navigate("/admin/login"); }

  return (
    <div className="admin-layout" style={{ fontFamily: "'Poppins',sans-serif" }}>
      <AdminSidebar
        tab={tab}
        setTab={setTab}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="admin-content">
        {/* Mobile hamburger */}
        <button
          className="admin-hamburger"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Menú"
        >
          <span>☰</span>
          <span style={{ fontSize: 14 }}>Admin Panel</span>
          <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>{user?.nombre}</span>
        </button>

        <div className="admin-content-inner">
          {/* Page header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: "clamp(18px,3vw,24px)", color: C.text, margin: 0 }}>
              {tab === "inicio"    && "Dashboard"}
              {tab === "activos"   && "En vivo"}
              {tab === "historial" && "Historial"}
              {tab === "cuentas"   && "Cuentas"}
            </h1>
            <p style={{ color: C.muted, fontSize: 13, margin: "4px 0 0" }}>
              {tab === "inicio"    && "Resumen general del parqueadero"}
              {tab === "activos"   && "Vehículos actualmente en el parqueadero"}
              {tab === "historial" && "Registro completo de entradas y salidas"}
              {tab === "cuentas"   && "Gestión de usuarios registrados"}
            </p>
          </div>

          {tab === "inicio" && (
            <>
              <div className="stats-row">
                <StatCard label="Sesiones hoy"         value={stats?.sesiones_hoy ?? "—"}         icon="📅" color="blue"   note="entradas hoy" />
                <StatCard label="En parqueadero"        value={stats?.vehiculos_activos ?? "—"}     icon="🚗" color="green"  note="vehículos ahora" />
                <StatCard label="Recaudo hoy"           value={stats ? `$${stats.recaudo_hoy.toLocaleString("es-CO")}` : "—"} icon="💰" color="yellow" note="pesos COP" />
                <StatCard label="Mensualidades activas" value={stats?.mensualidades_activas ?? "—"} icon="⊞" color="green"  note="periodo vigente" />
                <StatCard label="Usuarios"              value={stats?.total_usuarios ?? "—"}        icon="⊞" color="blue"   note="registrados" />
              </div>
              <SesionesActivas />
            </>
          )}
          {tab === "activos"   && <SesionesActivas />}
          {tab === "historial" && <HistorialAdmin />}
          {tab === "cuentas"   && <GestionCuentas />}
        </div>
      </div>
    </div>
  );
}

const ct = { color: C.text, fontSize: 15, fontWeight: 700, margin: "0 0 0", fontFamily: "'Montserrat',sans-serif" };
