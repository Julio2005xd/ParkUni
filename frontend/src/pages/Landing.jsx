// src/pages/Landing.jsx — Página de inicio
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";
import logo from "../assets/logo.png";

/* ── Inline SVG icons (no external dependency) ───────────────── */
const UserIcon = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const CameraIcon = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,.65)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

export default function Landing() {
  const navigate = useNavigate();
  const { estaLogueado, isAdmin } = useAuth();

  useEffect(() => {
    if (estaLogueado)
      navigate(isAdmin ? "/admin" : "/usuario", { replace: true });
  }, [estaLogueado, isAdmin, navigate]);

  return (
    <div style={s.page}>
      {/* Hero header */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.brand}>
            <img src={logo} alt="Logo ParqUni" style={s.logo} />
            <div>
              <div style={s.brandName}>ParqUni</div>
              <div style={s.brandSub}>Fundación Universitaria Monserrate</div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={s.hero}>
        <div style={s.heroContent}>
          <div style={s.heroBadge}>Sistema Inteligente v1.0</div>

          <h1 style={s.heroTitle}>
            Parqueadero
            <br />
            <span style={s.heroAccent}>Unimonserrate</span>
          </h1>

          <p style={s.heroDesc}>
            Gestión automatizada de acceso vehicular con reconocimiento QR, OCR
            de placas, facturación digital y reportes en tiempo real.
          </p>

          {/* Cards de acceso */}
          <div style={s.cards}>
            <button
              style={{ ...s.card, ...s.cardUser }}
              onClick={() => navigate("/usuario/login")}
            >
              <div style={s.cardIconWrap}>
                <UserIcon />
              </div>
              <div style={s.cardBody}>
                <div style={s.cardTitle}>Portal de Usuario</div>
                <div style={s.cardDesc}>
                  Regístrate, gestiona tu vehículo y genera tu QR de acceso
                </div>
              </div>
              <ArrowRightIcon />
            </button>

            <button
              style={{ ...s.card, ...s.cardAdmin }}
              onClick={() => navigate("/admin/login")}
            >
              <div style={s.cardIconWrap}>
                <ShieldCheckIcon />
              </div>
              <div style={s.cardBody}>
                <div style={s.cardTitle}>Panel Administrativo</div>
                <div style={s.cardDesc}>
                  Gestiona usuarios, mensualidades, reportes y cámara
                </div>
              </div>
              <ArrowRightIcon />
            </button>

            <button
              style={{ ...s.card, ...s.cardCam }}
              onClick={() => navigate("/camara")}
            >
              <div style={s.cardIconWrap}>
                <CameraIcon />
              </div>
              <div style={s.cardBody}>
                <div style={s.cardTitle}>Cámara de Seguridad</div>
                <div style={s.cardDesc}>
                  Detección OCR de placas en tiempo real · Entrada automática
                </div>
              </div>
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      </section>

      <footer style={s.footer}>
        Sistema Parqueadero Inteligente v1.0 · Ingeniería de Sistemas ·
        Unimonserrate · 2026
      </footer>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    fontFamily: "'Poppins', sans-serif",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
  },

  /* Header */
  header: {
    background: "#0d1b35",
    padding: "0 24px",
    boxShadow: "0 2px 12px rgba(0,0,0,.25)",
  },

  headerInner: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 64,
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  brandName: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800,
    color: "#fff",
    fontSize: 18,
    letterSpacing: -0.5,
  },

  brandSub: {
    fontSize: 10,
    color: "rgba(255,255,255,.45)",
    marginTop: 1,
  },

  logo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    borderRadius: 10,
  },

  /* Hero */
  hero: {
    flex: 1,
    background: "#ffffff",
    padding: "60px 24px 80px",
    display: "flex",
    justifyContent: "center",
  },

  heroContent: {
    maxWidth: 680,
    width: "100%",
    textAlign: "center",
  },

  heroBadge: {
    display: "inline-block",
    background: "rgba(0,255,64,0.08)",
    color: "#0da80d",
    border: "1px solid rgba(7,238,46,0.15)",
    padding: "4px 16px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 20,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  heroTitle: {
    fontFamily: "'Montserrat', sans-serif",
    fontSize: "clamp(32px, 6vw, 52px)",
    fontWeight: 900,
    color: "#0d1b35",
    lineHeight: 1.15,
    margin: "0 0 16px",
  },

  heroAccent: {
    color: "#0d4fa8",
  },

  heroDesc: {
    color: "#4b5563",
    fontSize: "clamp(13px, 2vw, 16px)",
    lineHeight: 1.7,
    maxWidth: 520,
    margin: "0 auto 44px",
  },

  /* Access cards */
  cards: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    maxWidth: 520,
    margin: "0 auto",
  },

  card: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "16px 20px",
    background: "#2f5fa7",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 14,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    boxShadow: "0 6px 18px rgba(13,79,168,.18)",
  },

  cardUser:  { background: "#2f5fa7" },
  cardAdmin: { background: "#3568b5" },
  cardCam:   { background: "#3b72c4" },

  cardIconWrap: {
    width: 50,
    height: 50,
    background: "rgba(255,255,255,.12)",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: "1px solid rgba(255,255,255,.08)",
  },

  cardBody: { flex: 1 },

  cardTitle: {
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 3,
  },

  cardDesc: {
    color: "rgba(255,255,255,.75)",
    fontSize: 12,
    lineHeight: 1.4,
  },

  /* Footer */
  footer: {
    background: "#0d1b35",
    color: "rgba(255,255,255,.35)",
    textAlign: "center",
    fontSize: 11,
    padding: "16px 24px",
    fontFamily: "'Poppins', sans-serif",
  },
};
