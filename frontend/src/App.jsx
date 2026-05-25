// src/App.jsx — Enrutamiento principal con React Router DOM
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Páginas
import Landing            from "./pages/Landing";
import UserLogin          from "./pages/user/UserLogin";
import UserRegister       from "./pages/user/UserRegister";
import UserDashboard      from "./pages/user/UserDashboard";
import AdminLogin         from "./pages/admin/AdminLogin";
import AdminDashboard     from "./pages/admin/AdminDashboard";
import AdminMensualidades from "./pages/admin/AdminMensualidades";
import AdminReportes      from "./pages/admin/AdminReportes";
import CamaraPlacas       from "./pages/CamaraPlacas";

// ── Rutas protegidas ──────────────────────────────────────────────
function PrivateRoute({ children, rol }) {
  const { estaLogueado, user } = useAuth();
  if (!estaLogueado) {
    return <Navigate to={rol === "admin" ? "/admin/login" : "/usuario/login"} replace />;
  }
  if (rol && user?.rol !== rol) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// ── App ───────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Landing */}
      <Route path="/" element={<Landing />} />

      {/* Usuario */}
      <Route path="/usuario/login"   element={<UserLogin />} />
      <Route path="/usuario/registro" element={<UserRegister />} />
      <Route path="/usuario" element={
        <PrivateRoute rol="usuario"><UserDashboard /></PrivateRoute>
      } />

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={
        <PrivateRoute rol="admin"><AdminDashboard /></PrivateRoute>
      } />
      <Route path="/admin/mensualidades" element={
        <PrivateRoute rol="admin"><AdminMensualidades /></PrivateRoute>
      } />
      <Route path="/admin/reportes" element={
        <PrivateRoute rol="admin"><AdminReportes /></PrivateRoute>
      } />

      {/* Cámara (acceso público) */}
      <Route path="/camara" element={<CamaraPlacas />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}