// src/pages/CamaraPlacas.jsx — Cámara OCR: detecta placas y registra entrada/salida
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ingresos, sesiones as sesionesApi } from "../services/api";
import { C } from "../theme";

const INTERVALO_OCR  = 2000;
const UMBRAL_CONF    = 0.4;
const FRAMES_ESTABLE = 3;

export default function CamaraPlacas() {
  const navigate = useNavigate();

  const [camActiva,      setCamActiva]      = useState(false);
  const [streaming,      setStreaming]      = useState(false);
  const [modo,           setModo]           = useState("auto");
  const [placaDetectada, setPlacaDetectada] = useState("");
  const [confianza,      setConfianza]      = useState(0);
  const [textoRaw,       setTextoRaw]       = useState("");
  const [imagenProc,     setImagenProc]     = useState(null);
  const [ocr,            setOcr]            = useState(false);

  const estableRef    = useRef({ placa: "", count: 0 });
  const intervaloRef  = useRef(null);
  const procesandoRef = useRef(false);

  const [eventos,   setEventos]   = useState([]);
  const [resultado, setResultado] = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  const detenerCamara = useCallback(() => {
    clearInterval(intervaloRef.current);
    if (videoRef.current?.srcObject)
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    setCamActiva(false);
    setStreaming(false);
    procesandoRef.current = false;
    estableRef.current = { placa: "", count: 0 };
  }, []);

  async function iniciarCamara() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCamActiva(true);
      setStreaming(true);
    } catch (err) {
      agregarEvento("error", "No se pudo acceder a la cámara: " + err.message, "");
    }
  }

  const capturarYProcesar = useCallback(async () => {
    if (procesandoRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    procesandoRef.current = true;
    setOcr(true);

    try {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) { procesandoRef.current = false; setOcr(false); return; }
        const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
        const res  = await ingresos.detectarPlaca(file);

        setTextoRaw(res.texto_raw || "");
        setConfianza(res.confianza || 0);
        if (res.imagen_procesada) setImagenProc(res.imagen_procesada);

        const placa = res.placa_detectada;
        setPlacaDetectada(placa || "");

        if (placa && res.confianza >= UMBRAL_CONF) {
          const est = estableRef.current;
          if (est.placa === placa) {
            est.count++;
            if (est.count >= FRAMES_ESTABLE && modo === "auto") {
              est.count = 0; est.placa = "";
              await registrarPorPlaca(placa);
            }
          } else {
            estableRef.current = { placa, count: 1 };
          }
        } else {
          estableRef.current = { placa: "", count: 0 };
        }
      }, "image/jpeg", 0.92);
    } catch {
      // silenciar errores de red
    } finally {
      procesandoRef.current = false;
      setOcr(false);
    }
  }, [modo]);

  useEffect(() => {
    if (streaming && modo === "auto") {
      intervaloRef.current = setInterval(capturarYProcesar, INTERVALO_OCR);
    } else {
      clearInterval(intervaloRef.current);
    }
    return () => clearInterval(intervaloRef.current);
  }, [streaming, modo, capturarYProcesar]);

  useEffect(() => () => detenerCamara(), [detenerCamara]);

  async function registrarPorPlaca(placa) {
    try {
      const r = await sesionesApi.camaraPlaca(placa);
      setResultado(r);
      agregarEvento(r.accion, r.mensaje, placa, r.usuario, r.accion === "salida" ? r.valor : null);
    } catch (err) {
      agregarEvento("error", err.message, placa);
    }
  }

  function agregarEvento(tipo, msg, placa, usuario = "", valor = null) {
    setEventos(ev => [{
      id: Date.now(), tipo, msg, placa, usuario, valor,
      hora: new Date().toLocaleTimeString("es-CO"),
    }, ...ev].slice(0, 30));
  }

  async function procesarImagen(file) {
    setOcr(true); setPlacaDetectada(""); setTextoRaw("");
    try {
      const res = await ingresos.detectarPlaca(file);
      setTextoRaw(res.texto_raw || "");
      setConfianza(res.confianza || 0);
      if (res.imagen_procesada) setImagenProc(res.imagen_procesada);
      if (res.placa_detectada) setPlacaDetectada(res.placa_detectada);
    } finally { setOcr(false); }
  }

  const confColor = confianza >= 0.7 ? C.green : confianza >= 0.4 ? C.yellow : C.red;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Poppins', sans-serif" }}>
      {/* Navbar */}
      <div style={{ background: C.bgNavy, padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 54, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/")}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", cursor: "pointer", fontSize: 13 }}>
            ← Inicio
          </button>
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.2)" }} />
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "#fff", fontSize: 14 }}>Cámara OCR</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>Detección automática de placas</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: streaming ? C.green : "#8496b0", animation: streaming ? "pulse 1.5s infinite" : "none" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: streaming ? C.green : "rgba(255,255,255,0.45)" }}>
            {streaming ? "EN VIVO" : "INACTIVO"}
          </span>
        </div>
      </div>

      {/* Grid — CSS class handles responsive stacking */}
      <div className="camara-grid">

        {/* ── Columna izquierda ── */}
        <div>
          {/* Video */}
          <div style={{ background: "#0d1b35", borderRadius: 12, overflow: "hidden", position: "relative", border: `2px solid ${streaming ? C.green : C.border}`, marginBottom: 12, boxShadow: streaming ? `0 0 18px ${C.green}33` : "none", transition: "box-shadow 0.3s" }}>
            <video ref={videoRef} style={{ width: "100%", display: "block", minHeight: 220 }} playsInline muted />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {streaming && (
              <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none" }}>
                {placaDetectada ? (
                  <div style={{ background: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "7px 12px", backdropFilter: "blur(6px)" }}>
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Placa detectada</div>
                    <div style={{ color: confColor, fontFamily: "monospace", fontSize: 22, fontWeight: 900, letterSpacing: 3 }}>
                      {placaDetectada}
                    </div>
                    <div style={{ color: confColor, fontSize: 10, marginTop: 1 }}>
                      {(confianza * 100).toFixed(0)}% · {estableRef.current.count}/{FRAMES_ESTABLE}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "rgba(0,0,0,0.65)", borderRadius: 8, padding: "7px 12px" }}>
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>{ocr ? "Procesando…" : "Buscando placa…"}</div>
                  </div>
                )}
                <div style={{ background: "rgba(0,0,0,0.65)", borderRadius: 8, padding: "5px 10px" }}>
                  <span style={{ color: modo === "auto" ? C.green : C.yellow, fontSize: 11, fontWeight: 700 }}>
                    {modo === "auto" ? "AUTO" : "MANUAL"}
                  </span>
                </div>
              </div>
            )}

            {!camActiva && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,27,53,0.9)" }}>
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.45)" }}>
                  <div style={{ fontSize: 44, marginBottom: 8 }}>📷</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>Cámara inactiva</div>
                  <div style={{ fontSize: 11, marginTop: 3 }}>Presiona "Iniciar" para comenzar</div>
                </div>
              </div>
            )}
          </div>

          {/* Controles */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {!camActiva ? (
              <button onClick={iniciarCamara}
                style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                Iniciar cámara
              </button>
            ) : (
              <button onClick={detenerCamara}
                style={{ background: C.redLight, color: C.red, border: `1px solid ${C.red}`, borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                Detener
              </button>
            )}

            <button onClick={() => setModo(m => m === "auto" ? "manual" : "auto")}
              style={{ background: "#fff", color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {modo === "auto" ? "Modo manual" : "Modo auto"}
            </button>

            {camActiva && modo === "manual" && (
              <button onClick={capturarYProcesar} disabled={ocr}
                style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: ocr ? 0.7 : 1 }}>
                {ocr ? "Procesando…" : "Capturar y analizar"}
              </button>
            )}

            {placaDetectada && modo === "manual" && (
              <button onClick={() => registrarPorPlaca(placaDetectada)}
                style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                Registrar {placaDetectada}
              </button>
            )}
          </div>

          {/* Upload imagen */}
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Procesar imagen estática:</div>
            <label style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, display: "inline-block" }}>
              Cargar imagen
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => e.target.files[0] && procesarImagen(e.target.files[0])} />
            </label>
            {imagenProc && (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: C.muted, fontSize: 11, marginBottom: 5 }}>Región procesada por OCR:</div>
                <img src={`data:image/jpeg;base64,${imagenProc}`} alt="proc"
                  style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 6, border: `2px solid ${C.border}` }} />
              </div>
            )}
          </div>

          {/* OCR raw */}
          {textoRaw && (
            <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 12 }}>
              <span style={{ color: C.muted, fontWeight: 600 }}>Texto OCR: </span>
              <span style={{ color: C.accent, fontFamily: "monospace", fontWeight: 700 }}>{textoRaw}</span>
              {confianza > 0 && (
                <span style={{ color: C.muted, marginLeft: 10 }}>
                  Confianza: <span style={{ color: confColor, fontWeight: 700 }}>{(confianza * 100).toFixed(1)}%</span>
                </span>
              )}
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div style={{ background: resultado.accion === "entrada" ? C.greenLight : C.primaryLight, border: `1px solid ${resultado.accion === "entrada" ? C.green : C.primary}`, borderRadius: 10, padding: 16, marginTop: 12 }}>
              <div style={{ fontWeight: 700, color: resultado.accion === "entrada" ? C.green : C.primary, fontSize: 15, marginBottom: 8, fontFamily: "'Montserrat',sans-serif" }}>
                {resultado.accion === "entrada" ? "ENTRADA" : "SALIDA"} — {resultado.placa}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 6, fontSize: 13 }}>
                <div><span style={{ color: C.muted }}>Usuario: </span><strong>{resultado.usuario || "visitante"}</strong></div>
                {resultado.accion === "salida" && <>
                  <div><span style={{ color: C.muted }}>Duración: </span><strong>{resultado.duracion}</strong></div>
                  <div><span style={{ color: C.muted }}>Total: </span><strong style={{ color: C.green }}>${resultado.valor?.toLocaleString("es-CO")} COP</strong></div>
                </>}
              </div>
              <button onClick={() => setResultado(null)}
                style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 12px", fontSize: 12, cursor: "pointer", marginTop: 10 }}>
                Cerrar
              </button>
            </div>
          )}
        </div>

        {/* ── Columna derecha: log de eventos ── */}
        <div>
          <div
            className="camara-log-panel"
            style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, height: "calc(100vh - 90px)", display: "flex", flexDirection: "column", position: "sticky", top: 66 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, color: C.text, fontSize: 13, fontFamily: "'Montserrat',sans-serif" }}>Log de eventos</span>
              <button onClick={() => setEventos([])}
                style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>
                Limpiar
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
              {eventos.length === 0 ? (
                <div style={{ color: C.muted, textAlign: "center", padding: "24px 12px", fontSize: 12 }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>🎥</div>
                  Sin eventos aún.
                </div>
              ) : (
                eventos.map(ev => (
                  <div key={ev.id} style={{
                    background: ev.tipo === "entrada" ? C.greenLight : ev.tipo === "salida" ? C.primaryLight : C.redLight,
                    border: `1px solid ${ev.tipo === "entrada" ? C.green : ev.tipo === "salida" ? C.primary : C.red}`,
                    borderRadius: 8, padding: "8px 10px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ev.tipo === "entrada" ? C.green : ev.tipo === "salida" ? C.primary : C.red }}>
                        {ev.tipo === "entrada" ? "ENTRADA" : ev.tipo === "salida" ? "SALIDA" : "ERROR"}
                        {ev.placa && <span style={{ fontFamily: "monospace", marginLeft: 6, letterSpacing: 1 }}>{ev.placa}</span>}
                      </span>
                      <span style={{ color: C.muted, fontSize: 10 }}>{ev.hora}</span>
                    </div>
                    <div style={{ color: C.text, fontSize: 11, marginTop: 3 }}>{ev.msg}</div>
                    {ev.usuario && <div style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>{ev.usuario}</div>}
                    {ev.valor != null && (
                      <div style={{ color: C.green, fontSize: 11, fontWeight: 700, marginTop: 2 }}>
                        ${ev.valor?.toLocaleString("es-CO")} COP
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modo info */}
            <div style={{ marginTop: 10, padding: "8px 10px", background: C.bg, borderRadius: 8, fontSize: 11 }}>
              <div style={{ fontWeight: 700, color: modo === "auto" ? C.green : C.yellow, marginBottom: 3 }}>
                {modo === "auto" ? "Modo automático" : "Modo manual"}
              </div>
              <div style={{ color: C.muted, lineHeight: 1.5 }}>
                {modo === "auto"
                  ? `Captura cada ${INTERVALO_OCR / 1000}s. Registra al detectar la misma placa ${FRAMES_ESTABLE} veces.`
                  : `Pulsa "Capturar y analizar" para leer la placa, luego "Registrar" para confirmar.`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.3 } }
      `}</style>
    </div>
  );
}
