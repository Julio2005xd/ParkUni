// src/pages/admin/AdminLogin.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { authPageStyles as a, C } from "../../theme";
import logo from "../../assets/logo.png";

export default function AdminLogin() {
  const [correo,   setCorreo]   = useState("admin@parqueadero.edu.co");
  const [password, setPassword] = useState("admin123");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const data = await auth.login(correo, password);
      if (data.rol !== "admin") {
        setError("Esta cuenta no tiene permisos de administrador.");
        return;
      }
      login(data);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const bg = {
    ...a.bg,
    background: "linear-gradient(160deg, #0d1b35 0%, #1a2e5a 55%, #0d4fa8 100%)",
  };

  return (
    <div style={bg}>
      <div style={a.card}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <img src={logo} alt="ParqUni" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 10 }} />
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: C.text, fontSize: 16 }}>
              Admin Panel
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>Unimonserrate</div>
          </div>
        </div>

        <Link to="/" style={a.back}>← Inicio</Link>

        <h2 style={a.title}>Panel Administrativo</h2>
        <p style={a.sub}>Acceso exclusivo para administradores del parqueadero</p>

        {error && <div style={a.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={a.label}>Correo</label>
          <input style={a.input} type="email" required autoFocus
            value={correo} onChange={e => setCorreo(e.target.value)} />

          <label style={a.label}>Contraseña</label>
          <input style={a.input} type="password" required
            value={password} onChange={e => setPassword(e.target.value)} />

          <button style={{ ...a.btn, background: loading ? "#8496b0" : "#1e7e34" }}
            type="submit" disabled={loading}>
            {loading ? "Verificando…" : "Ingresar como Admin"}
          </button>
        </form>

        {/* Hint credenciales */}
        <div style={{ marginTop: 20, background: "#fff9e7", border: "1px solid #f0d080", borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, color: "#7a5800", fontWeight: 700, marginBottom: 4 }}>
            Credenciales por defecto
          </div>
          <div style={{ fontSize: 12, color: "#5a4200", fontFamily: "monospace" }}>
            {correo} / admin123
          </div>
        </div>
      </div>
    </div>
  );
}