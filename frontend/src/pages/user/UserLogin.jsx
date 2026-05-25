// src/pages/user/UserLogin.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { authPageStyles as a } from "../../theme";
import logo from "../../assets/logo.png";

export default function UserLogin() {
  const [correo,   setCorreo]   = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const data = await auth.login(correo, password);
      if (data.rol !== "usuario") {
        setError("Esta cuenta es de administrador. Usa el panel admin.");
        return;
      }
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
      <div style={a.card}>
        {/* Logo */}
        <div style={brand}>
          <img src={logo} alt="ParqUni" style={brandImg} />
          <div>
            <div style={brandTitle}>ParqUni</div>
            <div style={brandSub}>Unimonserrate</div>
          </div>
        </div>

        <Link to="/" style={a.back}>← Volver al inicio</Link>

        <h2 style={a.title}>Bienvenido</h2>
        <p style={a.sub}>Ingresa con tu correo y contraseña</p>

        {error && <div style={a.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={a.label}>Correo electrónico</label>
          <input
            style={a.input} type="email" required autoFocus
            value={correo} onChange={e => setCorreo(e.target.value)}
            placeholder="tucorreo@email.com"
          />

          <label style={a.label}>Contraseña</label>
          <input
            style={a.input} type="password" required
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <button style={{ ...a.btn, background: loading ? "#8496b0" : "#1a6ed8" }}
            type="submit" disabled={loading}>
            {loading ? "Verificando…" : "Ingresar"}
          </button>
        </form>

        <p style={registerLink}>
          ¿No tienes cuenta?{" "}
          <Link to="/usuario/registro" style={{ color: "#1a6ed8", fontWeight: 700 }}>
            Regístrate gratis
          </Link>
        </p>

        <div style={divider} />
        <div style={hint}>
          Acceso seguro con JWT · Unimonserrate © 2026
        </div>
      </div>
    </div>
  );
}

const brand      = { display: "flex", alignItems: "center", gap: 12, marginBottom: 24 };
const brandImg   = { width: 44, height: 44, objectFit: "contain", borderRadius: 10 };
const brandTitle = { fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#0d1b35", fontSize: 16 };
const brandSub   = { fontSize: 10, color: "#5a6a85" };
const registerLink = { color: "#5a6a85", fontSize: 13, textAlign: "center", marginTop: 20, marginBottom: 0 };
const divider   = { borderTop: "1px solid #d0dae8", margin: "20px 0 12px" };
const hint      = { color: "#8496b0", fontSize: 11, textAlign: "center" };