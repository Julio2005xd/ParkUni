// src/pages/user/UserRegister.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { authPageStyles as a } from "../../theme";
import logo from "../../assets/logo.png";

export default function UserRegister() {
  const [form, setForm]     = useState({ nombre: "", correo: "", password: "", documento: "", telefono: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const data = await auth.registrar(form);
      login(data);
      navigate("/usuario", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={a.bg}>
      <div style={{ ...a.card, maxWidth: 500 }}>
        {/* Logo */}
        <div style={brand}>
          <img src={logo} alt="ParqUni" style={brandImg} />
          <div>
            <div style={brandTitle}>ParqUni</div>
            <div style={brandSub}>Unimonserrate</div>
          </div>
        </div>

        <Link to="/usuario/login" style={a.back}>← Iniciar sesión</Link>

        <h2 style={a.title}>Crear Cuenta</h2>
        <p style={a.sub}>Regístrate para acceder al parqueadero con código QR</p>

        {error && <div style={a.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={grid}>
            <div>
              <label style={a.label}>Nombre completo *</label>
              <input style={a.input} required value={form.nombre}
                onChange={set("nombre")} placeholder="Juan Pérez" />
            </div>
            <div>
              <label style={a.label}>Documento</label>
              <input style={a.input} value={form.documento}
                onChange={set("documento")} placeholder="CC / TI / Pasaporte" />
            </div>
          </div>

          <label style={a.label}>Correo electrónico *</label>
          <input style={a.input} type="email" required value={form.correo}
            onChange={set("correo")} placeholder="tucorreo@email.com" />

          <label style={a.label}>Teléfono</label>
          <input style={a.input} value={form.telefono}
            onChange={set("telefono")} placeholder="3001234567" />

          <label style={a.label}>Contraseña * (mínimo 6 caracteres)</label>
          <input style={a.input} type="password" required minLength={6}
            value={form.password} onChange={set("password")} placeholder="••••••••" />

          <button style={{ ...a.btn, background: loading ? "#8496b0" : "#1a6ed8" }}
            type="submit" disabled={loading}>
            {loading ? "Creando cuenta…" : "Crear cuenta gratis"}
          </button>
        </form>

        <p style={foot}>
          ¿Ya tienes cuenta?{" "}
          <Link to="/usuario/login" style={{ color: "#1a6ed8", fontWeight: 700 }}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

const brand      = { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 };
const brandImg   = { width: 44, height: 44, objectFit: "contain", borderRadius: 10 };
const brandTitle = { fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#0d1b35", fontSize: 16 };
const brandSub   = { fontSize: 10, color: "#5a6a85" };
const grid      = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const foot      = { color: "#5a6a85", fontSize: 13, textAlign: "center", marginTop: 16, marginBottom: 0 };
