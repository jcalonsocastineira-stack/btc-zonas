"use strict";

/* ==========================================================
   BTC Zonas · app personal (HTML + CSS + JavaScript puro)
   Fuentes: Kraken (EUR, en directo), Binance (USD y respaldo),
   CoinGecko (segundo respaldo), Alternative.me (miedo y codicia).
   Los datos del usuario se guardan solo en este teléfono.
   ========================================================== */

const CLAVE = "btczonas.v1";
const CLAVE_VISTA = "btczonas.vista";

const DATOS_SISTEMA = {
  niveles: [
    { id: "z2", nombre: "Z2", tipo: "zona", min: 69400, max: 71000, estado: "comprada", nota: "Comprada el 25 oct" },
    { id: "z3", nombre: "Z3", tipo: "zona", min: 63200, max: 66700, estado: "rota", nota: "Rota el 13 nov" },
    { id: "z4", nombre: "Z4", tipo: "zona", min: 58500, max: 62300, estado: "rota", nota: "Rota el 14 nov. Se reactiva con 2 cierres seguidos por encima de 59.500 €" },
    { id: "z5", nombre: "Z5", tipo: "zona", min: 55500, max: 57500, estado: "rota", nota: "Comprada el 16 nov. Rota el 20 nov (cierre 53.688 €). Ahora hace de resistencia" },
    { id: "z6", nombre: "Z6", tipo: "zona", min: 50700, max: 52500, estado: "comprada", nota: "Comprada el 22 nov (señal fuerte de la vela del 21). Fibonacci 61,8 % del ciclo en 50.423 €" },
    { id: "z7", nombre: "Z7", tipo: "zona", min: 47400, max: 49500, estado: "activa", nota: "Banda inferior de Bollinger semanal + mínimos de sep. 2024. Solo con Reanudar (queda bajo la pausa)" },
    { id: "res", nombre: "Resistencia", tipo: "resistencia", min: 73000, max: 74600, estado: "activa", nota: "" },
    { id: "pausa", nombre: "Pausa", tipo: "pausa", min: 50650, max: null, estado: "activa", nota: "Sin compras automáticas si una vela cierra por debajo, hasta tocar Reanudar" }
  ],
  compras: [
    { id: "c1", fecha: "2026-10-10", precio: 74139.97, btc: 0.000674, total: 50.97, comision: 1, nota: "Antes del sistema", zona: "" },
    { id: "c2", fecha: "2026-10-25", precio: 72605.57, btc: 0.000275, total: 20.97, comision: 1, nota: "Z2", zona: "z2" },
    { id: "c3", fecha: "2026-10-31", precio: 69721.29, btc: 0.000286, total: 20.94, comision: 1, nota: "Z3", zona: "z3" },
    { id: "c4", fecha: "2026-11-16", precio: 59213.25, btc: 0.000675, total: 40.97, comision: 1, nota: "Z5 señal fuerte", zona: "z5" },
    { id: "c5", fecha: "2026-11-22", precio: 54998.1, btc: 0.00090458, total: 50, comision: 0.25, nota: "Z6 señal fuerte · Bit2Me Pro, limitada", zona: "z6" }
  ],
  notas: [],
  eventos: []
};

const TITULOS = { panel: "Panel", grafico: "Gráfico", analisis: "Análisis", calc: "Calculadora", bitacora: "Bitácora" };
const FG_ES = {
  "Extreme Fear": "Miedo extremo",
  "Fear": "Miedo",
  "Neutral": "Neutral",
  "Greed": "Codicia",
  "Extreme Greed": "Codicia extrema"
};
const NOMBRE_TIPO = { zona: "Zona de compra", resistencia: "Resistencia", soporte: "Soporte", pausa: "Pausa", otro: "Otro" };
const NOMBRE_ESTADO = { activa: "Activa", comprada: "Comprada", rota: "Rota" };

/* ---------- utilidades ---------- */

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[c]));
}

function miles(n) {
  return isFinite(n) ? Math.round(n).toLocaleString("es-ES") : "—";
}

function fmtEur(n, dec) {
  const d = dec || 0;
  if (!isFinite(n)) return "—";
  return n.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €";
}

function fmtPct(n, dec) {
  const d = dec === undefined ? 1 : dec;
  if (!isFinite(n)) return "—";
  return (n > 0 ? "+" : "") + n.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";
}

function fmtBtc(n) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("es-ES", { minimumFractionDigits: 6, maximumFractionDigits: 8 });
}

// Admite "53.688", "53688", "53.688,5", "0,000674" y "0.000674"
function num(texto) {
  if (texto === undefined || texto === null) return NaN;
  let t = String(texto).trim().replace(/\s/g, "").replace(/€|\$/g, "");
  if (t === "") return NaN;
  if (t.indexOf(",") >= 0) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = t.split(".");
    if (partes.length > 2) {
      t = partes.join("");
    } else if (partes.length === 2 && partes[1].length === 3 && partes[0] !== "0" && partes[0] !== "") {
      t = partes.join("");
    }
  }
  const v = Number(t);
  return isFinite(v) ? v : NaN;
}

function rangoTexto(n) {
  const tieneRango = isFinite(n.max) && n.max > n.min;
  return tieneRango ? miles(n.min) + "–" + miles(n.max) : miles(n.min);
}

function techo(n) {
  return isFinite(n.max) && n.max > n.min ? n.max : n.min;
}

function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function hoyLocal() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + dia;
}

function fechaBonita(iso) {
  const p = String(iso || "").split("-");
  if (p.length !== 3) return esc(iso);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
  return Number(p[2]) + " " + meses[Number(p[1]) - 1] + " " + p[0];
}

async function getJSON(url, ms) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ms || 8000);
  try {
    const r = await fetch(url, { signal: control.signal, cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(temporizador);
  }
}

/* ---------- almacenamiento ---------- */

function copiaSistema() {
  return JSON.parse(JSON.stringify(DATOS_SISTEMA));
}

function normalizar(d) {
  if (d && Array.isArray(d.compras) && Array.isArray(d.niveles)) {
    for (const c of d.compras) {
      if (c.zona !== undefined) continue;
      const m = /^\s*(Z\d+)/i.exec(c.nota || "");
      const z = m ? d.niveles.find((n) => String(n.nombre).toUpperCase() === m[1].toUpperCase()) : null;
      c.zona = z ? z.id : "";
    }
  }
  return {
    niveles: Array.isArray(d && d.niveles) ? d.niveles : [],
    compras: Array.isArray(d && d.compras) ? d.compras : [],
    notas: Array.isArray(d && d.notas) ? d.notas : [],
    eventos: Array.isArray(d && d.eventos) ? d.eventos : copiaSistema().eventos
  };
}

function cargarDatos() {
  try {
    const t = localStorage.getItem(CLAVE);
    if (t) return normalizar(JSON.parse(t));
  } catch (e) {
    /* sin acceso a localStorage: se usan los datos del sistema */
  }
  return copiaSistema();
}

let datos = cargarDatos();

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    if (typeof programarEnvio === "function") programarEnvio();
    return true;
  } catch (e) {
    avisoTemporal("No se pudo guardar en el teléfono.", "malo");
    return false;
  }
}

/* ---------- estado del mercado ---------- */

const mercado = {
  eur: NaN,
  usd: NaN,
  cambio24: NaN,
  maxEur: NaN,
  minEur: NaN,
  abiertoHoy: NaN,
  fuente: "",
  directo: false,
  actualizado: null
};

async function precioKraken() {
  const j = await getJSON("https://api.kraken.com/0/public/Ticker?pair=XBTEUR");
  if (j.error && j.error.length) throw new Error(j.error.join(", "));
  const clave = Object.keys(j.result)[0];
  const t = j.result[clave];
  return { eur: Number(t.c[0]), maxEur: Number(t.h[1]), minEur: Number(t.l[1]), abiertoHoy: Number(t.o) };
}

async function precioBinance(simbolo) {
  const j = await getJSON("https://api.binance.com/api/v3/ticker/24hr?symbol=" + simbolo);
  return {
    precio: Number(j.lastPrice),
    max: Number(j.highPrice),
    min: Number(j.lowPrice),
    abierto: Number(j.openPrice),
    cambio: Number(j.priceChangePercent)
  };
}

async function precioCoinGecko() {
  const j = await getJSON("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur&include_24hr_change=true");
  const b = j.bitcoin;
  return { eur: Number(b.eur), usd: Number(b.usd), cambio: Number(b.eur_24h_change) };
}

let pidiendoPrecios = false;

async function actualizarPrecios() {
  if (pidiendoPrecios) return;
  pidiendoPrecios = true;
  try {
    const res = await Promise.allSettled([precioKraken(), precioBinance("BTCEUR"), precioBinance("BTCUSDT")]);
    const k = res[0];
    const be = res[1];
    const bu = res[2];
    let fuente = "";

    if (k.status === "fulfilled") {
      if (!mercado.directo) mercado.eur = k.value.eur;
      mercado.maxEur = k.value.maxEur;
      mercado.minEur = k.value.minEur;
      mercado.abiertoHoy = k.value.abiertoHoy;
      fuente = "Kraken";
    } else if (be.status === "fulfilled") {
      mercado.eur = be.value.precio;
      mercado.maxEur = be.value.max;
      mercado.minEur = be.value.min;
      fuente = "Binance (respaldo)";
    }
    if (be.status === "fulfilled") mercado.cambio24 = be.value.cambio;
    if (bu.status === "fulfilled") mercado.usd = bu.value.precio;

    if (!fuente || bu.status !== "fulfilled" || be.status !== "fulfilled") {
      try {
        const g = await precioCoinGecko();
        if (!fuente) {
          mercado.eur = g.eur;
          fuente = "CoinGecko (respaldo)";
        }
        if (bu.status !== "fulfilled") mercado.usd = g.usd;
        if (be.status !== "fulfilled") mercado.cambio24 = g.cambio;
      } catch (e) {
        /* sin segundo respaldo */
      }
    }

    if (!fuente && !mercado.directo) {
      mercado.fuente = "";
      pintarEstado();
      return;
    }
    if (!mercado.directo) mercado.fuente = fuente;
    mercado.actualizado = new Date();
    pedirRepintado();
  } finally {
    pidiendoPrecios = false;
  }
}

/* ---------- precio en directo (WebSocket de Kraken) ---------- */

let ws = null;
let wsReintento = null;

function conectarDirecto() {
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  try {
    ws = new WebSocket("wss://ws.kraken.com/v2");
  } catch (e) {
    ws = null;
    return;
  }
  ws.onopen = () => {
    ws.send(JSON.stringify({ method: "subscribe", params: { channel: "ticker", symbol: ["BTC/EUR"] } }));
  };
  ws.onmessage = (ev) => {
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch (e) {
      return;
    }
    if (m.channel !== "ticker" || !Array.isArray(m.data) || !m.data[0]) return;
    const t = m.data[0];
    const ultimo = Number(t.last);
    if (!isFinite(ultimo)) return;
    mercado.eur = ultimo;
    if (isFinite(Number(t.high))) mercado.maxEur = Number(t.high);
    if (isFinite(Number(t.low))) mercado.minEur = Number(t.low);
    mercado.directo = true;
    mercado.fuente = "Kraken";
    mercado.actualizado = new Date();
    actualizarVelaEnVivo(ultimo);
    pedirRepintado();
  };
  ws.onclose = () => {
    ws = null;
    mercado.directo = false;
    pintarEstado();
    clearTimeout(wsReintento);
    if (document.visibilityState === "visible") wsReintento = setTimeout(conectarDirecto, 5000);
  };
  ws.onerror = () => {
    try {
      ws.close();
    } catch (e) {
      /* ya cerrado */
    }
  };
}

function desconectarDirecto() {
  clearTimeout(wsReintento);
  if (ws) {
    ws.onclose = null;
    try {
      ws.close();
    } catch (e) {
      /* ya cerrado */
    }
    ws = null;
  }
  mercado.directo = false;
}

let repintadoPendiente = false;

function pedirRepintado() {
  if (repintadoPendiente) return;
  repintadoPendiente = true;
  requestAnimationFrame(() => {
    repintadoPendiente = false;
    pintarPanel();
    revisarAvisos();
    if ($("v-analisis").classList.contains("activa")) pintarAnalisis();
    if ($("v-calc").classList.contains("activa")) {
      if (!$("c-entrada").value && isFinite(mercado.eur)) $("c-entrada").value = String(Math.round(mercado.eur));
      calcular();
    }
  });
}

/* ---------- panel ---------- */

function pintarEstado() {
  const punto = $("punto");
  punto.className = "punto";
  if (mercado.directo) {
    punto.classList.add("directo");
    $("fuente").textContent = "Kraken · en directo";
  } else if (mercado.fuente) {
    punto.classList.add("lento");
    $("fuente").textContent = mercado.fuente + " · cada minuto";
  } else {
    punto.classList.add("malo");
    $("fuente").textContent = "Sin conexión";
  }
}

function pintarCambio(el, valor, texto) {
  el.textContent = isFinite(valor) ? fmtPct(valor) + " " + texto : "— " + texto;
  el.className = isFinite(valor) ? (valor >= 0 ? "sube" : "baja") : "";
}

function pintarPanel() {
  $("p-eur").textContent = fmtEur(mercado.eur);
  $("p-usd").textContent = isFinite(mercado.usd) ? miles(mercado.usd) + " $" : "— $";
  pintarCambio($("p-24h"), mercado.cambio24, "en 24 h");
  const hoy = isFinite(mercado.abiertoHoy) && isFinite(mercado.eur) ? (mercado.eur / mercado.abiertoHoy - 1) * 100 : NaN;
  pintarCambio($("p-hoy"), hoy, "vela de hoy");
  $("p-max").textContent = fmtEur(mercado.maxEur);
  $("p-min").textContent = fmtEur(mercado.minEur);
  $("p-act").textContent = mercado.actualizado
    ? mercado.actualizado.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";
  pintarEstado();
  pintarCercanos();
  pintarCartera();
}

function pintarCuentaAtras() {
  const ahora = Date.now();
  const dia = 86400000;
  const proximo = Math.floor(ahora / dia) * dia + dia;
  const s = Math.max(0, Math.floor((proximo - ahora) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  $("p-cierre").textContent = h + " h " + String(m).padStart(2, "0") + " min";
}

function nivelesVigentes() {
  return datos.niveles.filter((n) => n.estado !== "rota" && isFinite(n.min));
}

function pintarCercanos() {
  const el = $("cercanos");
  const p = mercado.eur;
  if (!isFinite(p)) {
    el.innerHTML = "<div class=\"vacio\">Esperando el precio…</div>";
    return;
  }
  const lista = nivelesVigentes().map((n) => {
    const bajo = n.min;
    const alto = techo(n);
    const dentro = p >= bajo && p <= alto;
    const ref = dentro ? p : (p > alto ? alto : bajo);
    return { n: n, ref: ref, dentro: dentro, dist: (ref / p - 1) * 100 };
  });
  const encima = lista.filter((a) => !a.dentro && a.ref > p).sort((a, b) => a.ref - b.ref).slice(0, 2).reverse();
  const dentro = lista.filter((a) => a.dentro);
  const debajo = lista.filter((a) => !a.dentro && a.ref < p).sort((a, b) => b.ref - a.ref).slice(0, 2);
  const filas = encima.concat(dentro, debajo);
  if (filas.length === 0) {
    el.innerHTML = "<div class=\"vacio\">Añade niveles en la Bitácora.</div>";
    return;
  }
  el.innerHTML = filas.map((a) => {
    const derecha = a.dentro
      ? "<span class=\"sube\">Dentro</span>"
      : "<span class=\"" + (a.dist < 0 ? "baja" : "sube") + "\">" + fmtPct(a.dist) + "</span>";
    return "<div class=\"item\"><span>" + esc(a.n.nombre) + " <span class=\"sec\">" + rangoTexto(a.n) + " €</span></span>" + derecha + "</div>";
  }).join("");
}

function resumenCartera() {
  let btc = 0;
  let total = 0;
  let base = 0;
  for (const c of datos.compras) {
    const b = Number(c.btc) || 0;
    btc += b;
    total += Number(c.total) || 0;
    base += b * (Number(c.precio) || 0);
  }
  return { btc: btc, total: total, base: base, medio: btc > 0 ? base / btc : NaN };
}

function pintarCartera() {
  const el = $("cartera");
  const r = resumenCartera();
  if (r.btc <= 0) {
    el.innerHTML = "<div class=\"vacio\">Sin compras registradas.</div>";
    return;
  }
  const valor = isFinite(mercado.eur) ? r.btc * mercado.eur : NaN;
  const resultado = valor - r.total;
  const pct = r.total > 0 ? (resultado / r.total) * 100 : NaN;
  const clase = isFinite(resultado) ? (resultado >= 0 ? "sube" : "baja") : "";
  el.innerHTML =
    "<div class=\"item\"><span>BTC</span><span>" + fmtBtc(r.btc) + "</span></div>" +
    "<div class=\"item\"><span>Invertido <span class=\"sec\">con comisiones</span></span><span>" + fmtEur(r.total, 2) + "</span></div>" +
    "<div class=\"item\"><span>Precio medio <span class=\"sec\">sin comisiones</span></span><span>" + fmtEur(r.medio) + "</span></div>" +
    "<div class=\"item\"><span>Valor actual</span><span>" + fmtEur(valor, 2) + "</span></div>" +
    "<div class=\"item\"><span>Resultado</span><span class=\"" + clase + "\">" + fmtEur(resultado, 2) + " (" + fmtPct(pct) + ")</span></div>";
}

/* ---------- avisos dentro de la app ---------- */

let avisoFijo = { texto: "", clase: "" };
let avisoTemporalHasta = 0;

function mostrarAviso(texto, clase) {
  const el = $("aviso");
  if (!texto) {
    el.className = "aviso oculto";
    el.textContent = "";
    return;
  }
  el.className = "aviso " + clase;
  el.textContent = texto;
}

function avisoTemporal(texto, clase) {
  avisoTemporalHasta = Date.now() + 3500;
  mostrarAviso(texto, clase);
  setTimeout(() => {
    if (Date.now() >= avisoTemporalHasta) mostrarAviso(avisoFijo.texto, avisoFijo.clase);
  }, 3600);
}

function revisarAvisos() {
  const p = mercado.eur;
  let texto = "";
  let clase = "";
  if (isFinite(p)) {
    const zonas = datos.niveles.filter((n) => n.tipo === "zona" && n.estado === "activa" && isFinite(n.min));
    const pausas = datos.niveles.filter((n) => n.tipo === "pausa" && n.estado !== "rota" && isFinite(n.min));
    const bajoPausa = pausas.find((n) => p < n.min);
    const zonaDentro = zonas.find((z) => p >= z.min && p <= techo(z));
    const cercaPausa = pausas.find((n) => p >= n.min && p <= n.min * 1.02);
    const zonaCerca = zonas.find((z) => p > techo(z) && p <= techo(z) * 1.01);

    const pausaVig = typeof pausaActiva === "function" ? pausaActiva() : null;
    if (pausaVig) {
      texto = "Compras en pausa desde el " + fechaBonita(pausaVig.fecha) + " (cierre " + miles(pausaVig.cierre) + " €). Revisa y reanuda en Bitácora → Sistema.";
      clase = "malo";
    } else if (bajoPausa) {
      texto = "Por debajo del nivel de pausa (" + miles(bajoPausa.min) + " €). Si la vela cierra así, el widget se pausa.";
      clase = "malo";
    } else if (zonaDentro) {
      texto = "Precio dentro de " + zonaDentro.nombre + " (" + rangoTexto(zonaDentro) + " €). Espera al cierre de la vela y mira el widget.";
      clase = "info";
    } else if (cercaPausa) {
      texto = "A " + fmtPct((p / cercaPausa.min - 1) * 100) + " del nivel de pausa (" + miles(cercaPausa.min) + " €).";
      clase = "atento";
    } else if (zonaCerca) {
      texto = "A " + fmtPct((p / techo(zonaCerca) - 1) * 100) + " de " + zonaCerca.nombre + " (" + rangoTexto(zonaCerca) + " €).";
      clase = "atento";
    }
  }
  if (!texto) {
    const ev = eventoProximo(24);
    if (ev) {
      const horas = Math.max(0, Math.round((ev.ts - Date.now()) / 3600000));
      texto = "Dato macro en " + horas + " h: " + ev.nombre + " (" + cuandoEvento(ev) + "). Evita decidir en la hora del dato.";
      clase = "atento";
    }
  }
  avisoFijo = { texto: texto, clase: clase };
  if (Date.now() >= avisoTemporalHasta) mostrarAviso(texto, clase);
}

/* ---------- miedo y codicia ---------- */

function colorMiedo(v) {
  if (v < 25) return "#f0605d";
  if (v < 45) return "#ef9f27";
  if (v < 55) return "#8a8f9a";
  if (v < 75) return "#97c459";
  return "#3ecf8e";
}

async function actualizarMiedo() {
  try {
    const j = await getJSON("https://api.alternative.me/fng/?limit=8");
    const d = j.data;
    const v = Number(d[0].value);
    const el = $("fg-val");
    el.textContent = v + " · " + (FG_ES[d[0].value_classification] || d[0].value_classification);
    el.style.color = colorMiedo(v);
    $("fg-barra").style.width = Math.max(2, Math.min(100, v)) + "%";
    $("fg-barra").style.background = colorMiedo(v);
    $("fg-ayer").textContent = d[1] ? d[1].value : "—";
    $("fg-semana").textContent = d[7] ? d[7].value : "—";
    miedo.valor = v;
    miedo.texto = FG_ES[d[0].value_classification] || d[0].value_classification;
    miedo.ayer = d[1] ? d[1].value : "";
    miedo.semana = d[7] ? d[7].value : "";
  } catch (e) {
    $("fg-val").textContent = "Sin datos";
  }
}

/* ---------- gráfico ---------- */

let chart = null;
let serieVelas = null;
let seriesDibujadas = [];
let velas = [];
let intervalo = 1440;
let ajustarVista = true;

function crearGrafico() {
  if (chart) return true;
  if (!window.LightweightCharts) return false;
  const el = $("grafico");
  chart = LightweightCharts.createChart(el, {
    width: el.clientWidth,
    height: el.clientHeight,
    layout: { background: { type: "solid", color: "#0b0d12" }, textColor: "#8a8f9a", fontSize: 11 },
    grid: { vertLines: { color: "#151821" }, horzLines: { color: "#151821" } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.06, bottom: 0.22 } },
    timeScale: { borderVisible: false, rightOffset: 3 },
    crosshair: { mode: 0 },
    localization: { locale: "es-ES", priceFormatter: (p) => miles(p) }
  });
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    }).observe(el);
  }
  return true;
}

function colorNivel(n) {
  if (n.estado === "rota") return { linea: "#888780", relleno: "rgba(136,135,128,0.12)", estilo: 2 };
  if (n.tipo === "resistencia") return { linea: "#E24B4A", relleno: "rgba(226,75,74,0.16)", estilo: 0 };
  if (n.tipo === "pausa") return { linea: "#EF9F27", relleno: "rgba(239,159,39,0.14)", estilo: 1 };
  if (n.tipo === "zona" && n.estado === "comprada") return { linea: "#378ADD", relleno: "rgba(55,138,221,0.14)", estilo: 0 };
  if (n.tipo === "zona" || n.tipo === "soporte") return { linea: "#1D9E75", relleno: "rgba(29,158,117,0.22)", estilo: 0 };
  return { linea: "#8a8f9a", relleno: "rgba(138,143,154,0.12)", estilo: 2 };
}

function bollinger(v, n, k) {
  const arriba = [];
  const media = [];
  const abajo = [];
  for (let i = n - 1; i < v.length; i++) {
    let suma = 0;
    for (let j = i - n + 1; j <= i; j++) suma += v[j].close;
    const m = suma / n;
    let q = 0;
    for (let j = i - n + 1; j <= i; j++) q += (v[j].close - m) * (v[j].close - m);
    const sd = Math.sqrt(q / n);
    const t = v[i].time;
    arriba.push({ time: t, value: m + k * sd });
    media.push({ time: t, value: m });
    abajo.push({ time: t, value: m - k * sd });
  }
  return [arriba, media, abajo];
}

function construirSeries() {
  if (!crearGrafico() || velas.length === 0) return;
  for (const s of seriesDibujadas) chart.removeSeries(s);
  seriesDibujadas = [];
  const tiempos = velas.map((v) => v.time);

  for (const n of datos.niveles) {
    if (!isFinite(n.min)) continue;
    if (!(isFinite(n.max) && n.max > n.min)) continue;
    const c = colorNivel(n);
    const s = chart.addBaselineSeries({
      baseValue: { type: "price", price: n.min },
      topFillColor1: c.relleno,
      topFillColor2: c.relleno,
      topLineColor: "rgba(0,0,0,0)",
      bottomFillColor1: "rgba(0,0,0,0)",
      bottomFillColor2: "rgba(0,0,0,0)",
      bottomLineColor: "rgba(0,0,0,0)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null
    });
    s.setData(tiempos.map((t) => ({ time: t, value: n.max })));
    seriesDibujadas.push(s);
  }

  const vol = chart.addHistogramSeries({
    priceScaleId: "vol",
    priceFormat: { type: "volume" },
    lastValueVisible: false,
    priceLineVisible: false
  });
  chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  vol.setData(velas.map((v) => ({
    time: v.time,
    value: v.vol,
    color: v.close >= v.open ? "rgba(29,158,117,0.35)" : "rgba(226,75,74,0.35)"
  })));
  seriesDibujadas.push(vol);

  const bandas = bollinger(velas, 20, 2);
  bandas.forEach((datosBanda, i) => {
    const s = chart.addLineSeries({
      color: i === 1 ? "rgba(55,138,221,0.55)" : "rgba(55,138,221,0.35)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null
    });
    s.setData(datosBanda);
    seriesDibujadas.push(s);
  });

  serieVelas = chart.addCandlestickSeries({
    upColor: "#1D9E75",
    downColor: "#E24B4A",
    borderVisible: false,
    wickUpColor: "#1D9E75",
    wickDownColor: "#E24B4A",
    priceLineColor: "#f7931a",
    autoscaleInfoProvider: (original) => {
      const r = original();
      if (!r || !r.priceRange) return r;
      const margen = (r.priceRange.maxValue - r.priceRange.minValue) * 0.04;
      return { priceRange: { minValue: r.priceRange.minValue - margen, maxValue: r.priceRange.maxValue + margen } };
    }
  });
  serieVelas.setData(velas.map((v) => ({ time: v.time, open: v.open, high: v.high, low: v.low, close: v.close })));
  seriesDibujadas.push(serieVelas);

  for (const n of datos.niveles) {
    if (!isFinite(n.min)) continue;
    const c = colorNivel(n);
    const tieneRango = isFinite(n.max) && n.max > n.min;
    serieVelas.createPriceLine({
      price: tieneRango ? n.max : n.min,
      color: c.linea,
      lineWidth: 1,
      lineStyle: c.estilo,
      axisLabelVisible: true,
      title: n.nombre + (n.estado === "rota" ? " (rota)" : "")
    });
    if (tieneRango) {
      serieVelas.createPriceLine({ price: n.min, color: c.linea, lineWidth: 1, lineStyle: c.estilo, axisLabelVisible: false, title: "" });
    }
  }

  for (const r of infoRearme()) {
    serieVelas.createPriceLine({ price: r.umbral, color: "#378ADD", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: "Rearme " + r.zona.nombre });
  }

  const marcas = [];
  for (const c of datos.compras) {
    const ts = Date.parse(c.fecha + "T00:00:00Z") / 1000;
    if (!isFinite(ts)) continue;
    let t = null;
    for (const x of tiempos) {
      if (x <= ts) t = x;
      else break;
    }
    if (t === null) continue;
    marcas.push({ time: t, position: "belowBar", color: "#378ADD", shape: "arrowUp", size: 1.4 });
  }
  marcas.sort((a, b) => a.time - b.time);
  serieVelas.setMarkers(marcas);

  lineasLiq = [];
  dibujarLiquidaciones();
  lineasFib = [];
  dibujarFib();

  if (ajustarVista) {
    const barras = intervalo === 1440 ? 90 : 60;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, velas.length - barras), to: velas.length + 3 });
    ajustarVista = false;
  }
}

function centrarGrafico() {
  if (!chart || velas.length === 0) return;
  const barras = intervalo === 1440 ? 90 : 60;
  chart.priceScale("right").applyOptions({ autoScale: true });
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, velas.length - barras), to: velas.length + 3 });
}

async function cargarVelas() {
  const estado = $("graf-estado");
  estado.textContent = "Cargando velas de Kraken…";
  try {
    const j = await getJSON("https://api.kraken.com/0/public/OHLC?pair=XBTEUR&interval=" + intervalo, 12000);
    if (j.error && j.error.length) throw new Error(j.error.join(", "));
    const clave = Object.keys(j.result).find((x) => x !== "last");
    velas = j.result[clave].map((r) => ({
      time: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      vol: Number(r[6])
    }));
    ajustarVista = true;
    construirSeries();
    estado.textContent = "Kraken BTCEUR · " + velas.length + " velas " + (intervalo === 1440 ? "diarias" : "semanales") +
      ". La última vela se mueve en directo con el precio.";
  } catch (e) {
    estado.textContent = "No se pudieron cargar las velas. Toca Diario o Semanal para reintentar.";
  }
}

function actualizarVelaEnVivo(p) {
  if (!serieVelas || velas.length === 0) return;
  const duracion = intervalo * 60;
  const u = velas[velas.length - 1];
  const ahora = Math.floor(Date.now() / 1000);
  if (ahora >= u.time + duracion) {
    if (intervalo !== 1440) return;
    const nueva = { time: u.time + duracion, open: p, high: p, low: p, close: p, vol: 0 };
    velas.push(nueva);
    serieVelas.update({ time: nueva.time, open: p, high: p, low: p, close: p });
    return;
  }
  u.close = p;
  if (p > u.high) u.high = p;
  if (p < u.low) u.low = p;
  serieVelas.update({ time: u.time, open: u.open, high: u.high, low: u.low, close: u.close });
}

function abrirGrafico() {
  if (!crearGrafico()) {
    $("graf-estado").textContent = "No se pudo cargar la librería del gráfico. Comprueba la conexión y vuelve a abrir la app.";
    return;
  }
  const el = $("grafico");
  chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
  if (velas.length === 0) cargarVelas();
}

/* ---------- liquidaciones estimadas (modelo propio con datos públicos de Binance) ----------
   Cada hora en la que sube el interés abierto se suponen posiciones nuevas al precio medio de esa hora,
   repartidas entre largos y cortos según el índice de cuentas de Binance y con apalancamientos típicos.
   Cuando el precio cruza un nivel de liquidación, ese nivel se da por ejecutado y desaparece.
   Cuando baja el interés abierto, todas las posiciones vivas se reducen en la misma proporción. */

const APALANCAMIENTOS = [[10, 0.1], [25, 0.25], [50, 0.35], [100, 0.3]];
const PASO_LIQ_MS = 1800000;
const VELAS_LIQ = 336;
const MANTENIMIENTO = 0.004;
const CLAVE_LIQ = "btczonas.liq";

let liq = { niveles: [], precioUsd: NaN, actualizado: null, error: "" };
let lineasLiq = [];
let mostrarLiq = true;
let calculandoLiq = false;

try {
  mostrarLiq = localStorage.getItem(CLAVE_LIQ) !== "no";
} catch (e) {
  mostrarLiq = true;
}

async function seriePaginada(base, limite, total) {
  const porTiempo = new Map();
  let fin = Date.now();
  for (let vuelta = 0; vuelta < 4 && porTiempo.size < total; vuelta++) {
    const j = await getJSON(base + "&limit=" + limite + "&endTime=" + fin, 12000);
    if (!Array.isArray(j) || j.length === 0) break;
    let primero = Infinity;
    for (const x of j) {
      const t = Number(x.timestamp);
      porTiempo.set(t, x);
      if (t < primero) primero = t;
    }
    if (j.length < limite) break;
    fin = primero - 1;
  }
  return porTiempo;
}

function modeloLiquidaciones(velasF, mapaOI, mapaLS) {
  let vivos = [];
  let partLargos = 0.5;
  for (const k of velasF) {
    const t = Number(k[0]);
    const alto = Number(k[2]);
    const bajo = Number(k[3]);
    const cierre = Number(k[4]);
    vivos = vivos.filter((p) => (p.lado === "largo" ? p.precio < bajo : p.precio > alto));
    if (mapaLS.has(t)) {
      const v = Number(mapaLS.get(t).longAccount);
      if (v > 0 && v < 1) partLargos = v;
    }
    const a = mapaOI.get(t);
    const b = mapaOI.get(t + PASO_LIQ_MS);
    if (!a || !b) continue;
    const oiA = Number(a.sumOpenInterest);
    const oiB = Number(b.sumOpenInterest);
    if (!(oiA > 0) || !(oiB > 0)) continue;
    const delta = oiB - oiA;
    if (delta > 0) {
      const entrada = (alto + bajo + cierre) / 3;
      for (const par of APALANCAMIENTOS) {
        const lev = par[0];
        const peso = par[1];
        vivos.push({ lado: "largo", precio: entrada * (1 - 1 / lev + MANTENIMIENTO), btc: delta * partLargos * peso, entrada: entrada });
        vivos.push({ lado: "corto", precio: entrada * (1 + 1 / lev - MANTENIMIENTO), btc: delta * (1 - partLargos) * peso, entrada: entrada });
      }
    } else if (delta < 0) {
      const f = oiB / oiA;
      for (const p of vivos) p.btc *= f;
    }
  }
  const P = Number(velasF[velasF.length - 1][4]);
  const paso = P * 0.0025;
  const cubos = new Map();
  for (const p of vivos) {
    if (!(p.btc > 0) || Math.abs(p.precio / P - 1) > 0.2) continue;
    const clave = Math.round(p.precio / paso);
    const c = cubos.get(clave) || { precio: clave * paso, largo: 0, corto: 0 };
    c[p.lado] += p.btc * p.entrada;
    cubos.set(clave, c);
  }
  return { niveles: Array.from(cubos.values()).sort((x, y) => x.precio - y.precio), precioUsd: P };
}

async function calcularLiquidaciones() {
  if (calculandoLiq || !mostrarLiq) return;
  calculandoLiq = true;
  try {
    const res = await Promise.all([
      getJSON("https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=30m&limit=" + (VELAS_LIQ + 1), 12000),
      seriePaginada("https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=30m", 500, VELAS_LIQ + 2),
      seriePaginada("https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=30m", 500, VELAS_LIQ + 2)
    ]);
    if (!Array.isArray(res[0]) || res[0].length < 24 || res[1].size < 24) throw new Error("pocos datos");
    const m = modeloLiquidaciones(res[0], res[1], res[2]);
    liq = { niveles: m.niveles, precioUsd: m.precioUsd, actualizado: new Date(), error: "" };
  } catch (e) {
    liq.error = "No se pudieron calcular. Se reintentará en unos minutos.";
  } finally {
    calculandoLiq = false;
  }
  pintarLiquidaciones();
  dibujarLiquidaciones();
}

function factorEur() {
  if (isFinite(mercado.eur) && isFinite(mercado.usd) && mercado.usd > 0) return mercado.eur / mercado.usd;
  return NaN;
}

function millones(v) {
  if (!isFinite(v)) return "—";
  const m = v / 1e6;
  return m.toLocaleString("es-ES", { maximumFractionDigits: m < 10 ? 1 : 0 }) + "\u00a0M$";
}

function sumaLiq(lado, desde, hasta) {
  let s = 0;
  for (const n of liq.niveles) {
    if (n.precio >= desde && n.precio <= hasta) s += n[lado];
  }
  return s;
}

function mayorGrupo(lado) {
  const P = liq.precioUsd;
  let mejor = null;
  for (const n of liq.niveles) {
    const valido = lado === "largo" ? n.precio < P : n.precio > P;
    if (valido && n[lado] > 0 && (!mejor || n[lado] > mejor[lado])) mejor = n;
  }
  return mejor;
}

function pintarLiquidaciones() {
  const el = $("liq-resumen");
  if (!el) return;
  $("tarjeta-liq").classList.toggle("oculto", !mostrarLiq);
  if (!mostrarLiq) return;
  $("liq-act").textContent = liq.actualizado
    ? liq.actualizado.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "—";
  if (liq.niveles.length === 0) {
    el.innerHTML = "<div class=\"vacio\">" + esc(liq.error || "Calculando…") + "</div>";
    return;
  }
  const P = liq.precioUsd;
  const f = factorEur();
  const abajo = [1, 3, 5].map((x) => millones(sumaLiq("largo", P * (1 - x / 100), P)));
  const arriba = [1, 3, 5].map((x) => millones(sumaLiq("corto", P, P * (1 + x / 100))));
  const gAbajo = mayorGrupo("largo");
  const gArriba = mayorGrupo("corto");
  const grupo = (g, lado) => {
    if (!g) return "—";
    const precio = isFinite(f) ? fmtEur(g.precio * f) : miles(g.precio) + " $";
    return precio + " (" + fmtPct((g.precio / P - 1) * 100) + ") · " + millones(g[lado]);
  };
  el.innerHTML =
    "<div class=\"item\"><span>Si baja <span class=\"sec\">−1 / −3 / −5 %</span></span><span>" + abajo.join(" · ") + "</span></div>" +
    "<div class=\"item\"><span>Si sube <span class=\"sec\">+1 / +3 / +5 %</span></span><span>" + arriba.join(" · ") + "</span></div>" +
    "<div class=\"item\"><span>Mayor grupo debajo <span class=\"sec\">largos</span></span><span>" + grupo(gAbajo, "largo") + "</span></div>" +
    "<div class=\"item\"><span>Mayor grupo encima <span class=\"sec\">cortos</span></span><span>" + grupo(gArriba, "corto") + "</span></div>" +
    (liq.error ? "<div class=\"vacio\">" + esc(liq.error) + "</div>" : "");
}

function dibujarLiquidaciones() {
  if (!serieVelas) return;
  for (const l of lineasLiq) {
    try {
      serieVelas.removePriceLine(l);
    } catch (e) {
      /* la línea ya no existe */
    }
  }
  lineasLiq = [];
  const boton = $("b-liq");
  if (boton) boton.setAttribute("aria-pressed", mostrarLiq ? "true" : "false");
  if (!mostrarLiq || liq.niveles.length === 0) return;
  const f = factorEur();
  if (!isFinite(f)) return;
  const P = liq.precioUsd;
  const cerca = (n) => Math.abs(n.precio / P - 1) <= 0.12;
  const abajo = liq.niveles.filter((n) => n.precio < P && n.largo > 0 && cerca(n)).sort((x, y) => y.largo - x.largo).slice(0, 8);
  const arriba = liq.niveles.filter((n) => n.precio > P && n.corto > 0 && cerca(n)).sort((x, y) => y.corto - x.corto).slice(0, 8);
  const maximo = Math.max(1, ...abajo.map((n) => n.largo), ...arriba.map((n) => n.corto));
  const dibujar = (n, valor) => {
    const rel = valor / maximo;
    lineasLiq.push(serieVelas.createPriceLine({
      price: n.precio * f,
      color: "rgba(232,197,71," + (0.15 + 0.6 * rel).toFixed(2) + ")",
      lineWidth: rel > 0.6 ? 3 : (rel > 0.3 ? 2 : 1),
      lineStyle: 0,
      axisLabelVisible: false,
      title: ""
    }));
  };
  abajo.forEach((n) => dibujar(n, n.largo));
  arriba.forEach((n) => dibujar(n, n.corto));
}

function alternarLiquidaciones() {
  mostrarLiq = !mostrarLiq;
  try {
    localStorage.setItem(CLAVE_LIQ, mostrarLiq ? "si" : "no");
  } catch (e) {
    /* sin almacenamiento */
  }
  dibujarLiquidaciones();
  pintarLiquidaciones();
  if (mostrarLiq && liq.niveles.length === 0) calcularLiquidaciones();
}

/* ---------- Fibonacci de 6 meses (igual que el widget: solo información) ---------- */

const FIB_R = [0.236, 0.382, 0.5, 0.618, 0.786];
const CLAVE_FIB = "btczonas.fib";
// Modo del botón Fib: "ciclo" (soportes de la gran subida), "bajada" (caída de 6 meses, como en TradingView) o "no".
let modoFib = "ciclo";
let lineasFib = [];

try {
  const g = localStorage.getItem(CLAVE_FIB);
  modoFib = g === "no" ? "no" : g === "bajada" ? "bajada" : "ciclo";
} catch (e) {
  modoFib = "ciclo";
}

// Retroceso de Fibonacci del ciclo: última gran subida, del mínimo de nov. 2022 al máximo histórico de oct. 2025
// (BTCEUR Bitstamp). Se dibuja como el retroceso clásico: 0 % arriba (máximo) y 100 % abajo (mínimo).
// Si el precio marca un máximo nuevo, se usa ese máximo.
const CICLO = { bajo: 15115, fechaBajo: "nov. 2022", alto: 107544, fechaAlto: "oct. 2025" };
const FIB_CICLO = [0.236, 0.382, 0.5, 0.618, 0.705, 0.786];

function fibCiclo() {
  let alto = CICLO.alto;
  let fechaAlto = CICLO.fechaAlto;
  for (const x of ana.d) {
    if (x.high > alto) {
      alto = x.high;
      fechaAlto = new Date(x.time * 1000).toLocaleDateString("es-ES", { month: "short", year: "numeric" });
    }
  }
  const rango = alto - CICLO.bajo;
  return {
    alto: alto,
    bajo: CICLO.bajo,
    fechaAlto: fechaAlto,
    fechaBajo: CICLO.fechaBajo,
    niveles: FIB_CICLO.map((r) => ({ r: r, p: alto - r * rango }))
  };
}

// Rebotes de los últimos 6 meses (método del widget): solo como mapa de resistencias.
function fibonacci() {
  const ahora = Date.now() / 1000;
  const cerradas = ana.d.filter((x) => x.time + 86400 <= ahora).slice(-182);
  if (cerradas.length < 60) return null;
  let alto = cerradas[0];
  let bajo = cerradas[0];
  for (const x of cerradas) {
    if (x.high > alto.high) alto = x;
    if (x.low < bajo.low) bajo = x;
  }
  const sube = alto.time > bajo.time;
  const rango = alto.high - bajo.low;
  return {
    sube: sube,
    alto: alto.high,
    bajo: bajo.low,
    niveles: FIB_R.map((r) => ({ r: r, p: alto.high - r * rango }))
  };
}

function zonaDeFib(p) {
  const z = datos.niveles.find((n) => (n.tipo === "zona" || n.tipo === "resistencia") && isFinite(n.min) && p <= techo(n) * 1.01 && p >= n.min * 0.99);
  return z ? z.nombre + (z.estado === "rota" ? " (rota)" : z.estado === "comprada" ? " (comprada)" : "") : "";
}

const pctFib = (r) => (r * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " %";

function papelFib(p) {
  const precio = ana.d.length ? ana.d[ana.d.length - 1].close : 0;
  if (!precio) return "";
  return p < precio ? "soporte" : "resistencia";
}

function pintarFib() {
  const el = $("a-fib");
  if (!el) return;
  if (!ana.d.length) {
    el.innerHTML = "<div class=\"vacio\">" + esc(ana.error || "Cargando velas…") + "</div>";
    return;
  }
  const c = fibCiclo();
  const fila = (l) => {
    const z = zonaDeFib(l.p);
    const papel = papelFib(l.p);
    return filaHtml(pctFib(l.r) + " <span class=\"sec\">" + esc(papel + (z ? " · " + z : "")) + "</span>", fmtEur(l.p) + distanciaA(l.p));
  };
  let html =
    "<div class=\"vacio\">Retroceso del ciclo: 0 % arriba = máximo " + fmtEur(c.alto) + " (" + esc(c.fechaAlto) + ") · 100 % abajo = mínimo " + fmtEur(c.bajo) + " (" + esc(c.fechaBajo) + "). Los niveles por debajo del precio son soportes; el 61,8 % es el más vigilado.</div>" +
    c.niveles.map(fila).join("");
  const f = fibonacci();
  if (f) {
    html += "<div class=\"vacio\" style=\"margin-top:10px\">" + (f.sube ? "Subida" : "Bajada") + " de los últimos 6 meses, como en TradingView: 0 % arriba = " + fmtEur(f.alto) + " · 100 % abajo = " + fmtEur(f.bajo) + ".</div>" +
      f.niveles.map(fila).join("");
  }
  el.innerHTML = html;
}

function dibujarFib() {
  if (!serieVelas) return;
  for (const l of lineasFib) {
    try {
      serieVelas.removePriceLine(l);
    } catch (e) {
      /* la línea ya no existe */
    }
  }
  lineasFib = [];
  const boton = $("b-fib");
  if (boton) {
    boton.setAttribute("aria-pressed", modoFib === "no" ? "false" : "true");
    boton.textContent = modoFib === "ciclo" ? "Fib ciclo" : modoFib === "bajada" ? "Fib 6 m" : "Fib";
  }
  if (modoFib === "no") return;
  let niveles;
  let extremos = [];
  if (modoFib === "ciclo") {
    niveles = fibCiclo().niveles;
  } else {
    const f = fibonacci();
    if (!f) return;
    niveles = f.niveles;
    extremos = [{ r: 0, p: f.alto }, { r: 1, p: f.bajo }];
  }
  for (const l of extremos.concat(niveles)) {
    lineasFib.push(serieVelas.createPriceLine({
      price: l.p,
      color: l.r === 0 || l.r === 1 ? "rgba(160,160,160,0.6)" : "rgba(232,170,70,0.75)",
      lineWidth: l.r === 0.618 ? 2 : 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "Fib " + pctFib(l.r)
    }));
  }
}

function alternarFib() {
  modoFib = modoFib === "ciclo" ? "bajada" : modoFib === "bajada" ? "no" : "ciclo";
  try {
    localStorage.setItem(CLAVE_FIB, modoFib);
  } catch (e) {
    /* sin almacenamiento */
  }
  dibujarFib();
}

/* ---------- análisis: indicadores, señal provisional, importe, derivados y calendario ---------- */

const CLAVE_LIQUIDEZ = "btczonas.liquidez";
const ana = { d: [], w: [], actualizado: null, error: "" };
const der = { datos: null, actualizado: null, error: "" };
const miedo = { valor: NaN, texto: "", ayer: "", semana: "" };

async function velasKraken(intervaloMin) {
  const j = await getJSON("https://api.kraken.com/0/public/OHLC?pair=XBTEUR&interval=" + intervaloMin, 12000);
  if (j.error && j.error.length) throw new Error(j.error.join(", "));
  const clave = Object.keys(j.result).find((x) => x !== "last");
  return j.result[clave].map((r) => ({
    time: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    vol: Number(r[6])
  }));
}

let cargandoAnalisis = false;

async function actualizarAnalisis() {
  if (cargandoAnalisis) return;
  cargandoAnalisis = true;
  try {
    const r = await Promise.all([velasKraken(1440), velasKraken(10080)]);
    ana.d = r[0];
    ana.w = r[1];
    ana.actualizado = new Date();
    ana.error = "";
  } catch (e) {
    ana.error = "No se pudieron cargar las velas de Kraken.";
  } finally {
    cargandoAnalisis = false;
  }
  revisarRearme();
  pintarAnalisis();
  dibujarFib();
}

function conPrecioVivo(velasOrigen, duracion, precio) {
  if (velasOrigen.length === 0) return velasOrigen;
  const copia = velasOrigen.slice();
  const u = Object.assign({}, copia[copia.length - 1]);
  const p = precio !== undefined ? precio : mercado.eur;
  if (isFinite(p) && Date.now() / 1000 < u.time + duracion) {
    u.close = p;
    if (p > u.high) u.high = p;
    if (p < u.low) u.low = p;
  }
  copia[copia.length - 1] = u;
  return copia;
}

function rsiWilder(cierres, n) {
  if (cierres.length < n + 1) return NaN;
  let ganancia = 0;
  let perdida = 0;
  for (let i = 1; i <= n; i++) {
    const d = cierres[i] - cierres[i - 1];
    if (d > 0) ganancia += d;
    else perdida -= d;
  }
  let mg = ganancia / n;
  let mp = perdida / n;
  for (let i = n + 1; i < cierres.length; i++) {
    const d = cierres[i] - cierres[i - 1];
    mg = (mg * (n - 1) + Math.max(d, 0)) / n;
    mp = (mp * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (mp === 0) return 100;
  return 100 - 100 / (1 + mg / mp);
}

function mediaUltimos(valores, n) {
  if (valores.length < n) return NaN;
  let s = 0;
  for (let i = valores.length - n; i < valores.length; i++) s += valores[i];
  return s / n;
}

function indicadores(precio) {
  if (ana.d.length < 30 || ana.w.length < 20) return null;
  const d = conPrecioVivo(ana.d, 86400, precio);
  const w = conPrecioVivo(ana.w, 604800, precio);
  const hoy = d[d.length - 1];
  const ayer = d[d.length - 2];
  const cd = d.map((x) => x.close);
  const cw = w.map((x) => x.close);
  const m20 = mediaUltimos(cd, 20);
  let q = 0;
  for (let i = cd.length - 20; i < cd.length; i++) q += (cd[i] - m20) * (cd[i] - m20);
  const sd = Math.sqrt(q / 20);
  const volMedia = mediaUltimos(d.map((x) => x.vol), 20);
  let atr = 0;
  for (let i = 1; i < d.length; i++) {
    const tr = Math.max(d[i].high - d[i].low, Math.abs(d[i].high - d[i - 1].close), Math.abs(d[i].low - d[i - 1].close));
    if (i <= 14) {
      atr += tr;
      if (i === 14) atr /= 14;
    } else {
      atr = (atr * 13 + tr) / 14;
    }
  }
  let sPos = 0;
  let sNeg = 0;
  let sTr = 0;
  let adx = NaN;
  let sumaDx = 0;
  for (let i = 1; i < d.length; i++) {
    const subida = d[i].high - d[i - 1].high;
    const bajada = d[i - 1].low - d[i].low;
    const pos = subida > bajada && subida > 0 ? subida : 0;
    const neg = bajada > subida && bajada > 0 ? bajada : 0;
    const tr = Math.max(d[i].high - d[i].low, Math.abs(d[i].high - d[i - 1].close), Math.abs(d[i].low - d[i - 1].close));
    if (i <= 14) {
      sPos += pos;
      sNeg += neg;
      sTr += tr;
    } else {
      sPos = sPos - sPos / 14 + pos;
      sNeg = sNeg - sNeg / 14 + neg;
      sTr = sTr - sTr / 14 + tr;
    }
    if (i >= 14 && sTr > 0) {
      const diP = (100 * sPos) / sTr;
      const diN = (100 * sNeg) / sTr;
      const dx = diP + diN > 0 ? (100 * Math.abs(diP - diN)) / (diP + diN) : 0;
      if (i < 28) {
        sumaDx += dx;
        if (i === 27) adx = sumaDx / 14;
      } else {
        adx = (adx * 13 + dx) / 14;
      }
    }
  }
  const ahora = Date.now() / 1000;
  const semanasCerradas = ana.w.filter((x) => x.time + 604800 <= ahora);
  const cwc = semanasCerradas.map((x) => x.close);
  const ultimaSemana = semanasCerradas[semanasCerradas.length - 1];
  let max182 = 0;
  for (const x of d.slice(-182)) if (x.high > max182) max182 = x.high;
  return {
    hoy: hoy,
    ayer: ayer,
    rsiD: rsiWilder(cd, 14),
    rsiW: rsiWilder(cw, 14),
    bbSup: m20 + 2 * sd,
    bbMed: m20,
    bbInf: m20 - 2 * sd,
    volRel: hoy.vol / volMedia,
    volMedia: volMedia,
    atr: atr,
    adx: adx,
    ma200d: mediaUltimos(cd, 200),
    ma20w: mediaUltimos(cwc, 20),
    ma200w: mediaUltimos(cwc, 200),
    cierreSemana: ultimaSemana ? ultimaSemana.close : NaN,
    max182: max182,
    retroceso: (1 - hoy.low / max182) * 100
  };
}

// Réplica de evaluate2 y verdict2 del widget de Scriptable (modelo v2).
function evaluarSenal(ind) {
  const v = ind.hoy;
  const margen = 0.5 * ind.atr;
  const rango = v.high - v.low;
  const cuerpo = Math.abs(v.open - v.close);
  const mecha = Math.min(v.open, v.close) - v.low;
  const posCierre = rango > 0 ? (v.close - v.low) / rango : 0;
  const cierreAlto = posCierre >= 0.5;
  const zonas = datos.niveles.filter((n) => n.tipo === "zona" && n.estado !== "rota" && isFinite(n.min));
  const candidatas = zonas
    .filter((z) => v.low <= techo(z) + margen && v.close >= z.min - margen)
    .sort((a, b) => techo(a) - techo(b));
  let zona = candidatas.find((z) => z.estado !== "comprada") || candidatas[0] || null;
  const rota = !!zona && zona.estado !== "comprada" && v.close < zona.min;
  if (rota) zona = null;
  const zonaRota = rota ? candidatas.find((z) => z.estado !== "comprada") : null;
  const comprada = !!zona && zona.estado === "comprada";
  const toqueBanda = v.low < ind.bbInf && v.close > ind.bbInf;
  const mechaOk = (mecha / v.close) * 100 >= 1 && mecha >= cuerpo;
  const rechazo = (toqueBanda || mechaOk) && cierreAlto && (!zona || v.close >= zona.min);
  const confirmacion = ind.rsiD < 45 || ind.volRel >= 1.3;
  const cerca200 = isFinite(ind.ma200w) && v.low <= ind.ma200w * 1.03;
  const capitulacion = ind.rsiD < 35 && ind.volRel >= 1.5;
  const bajista = (isFinite(ind.ma200d) && v.close < ind.ma200d) || (isFinite(ind.ma20w) && ind.cierreSemana < ind.ma20w);
  let mult = 1;
  if (cerca200) {
    mult = 2;
  } else {
    if (capitulacion) mult = 2;
    if (bajista) mult *= 0.5;
  }
  const senal = !!zona && rechazo && confirmacion;
  const cautela = senal && mult < 1;
  const pausada = !!(typeof pausaActiva === "function" && pausaActiva());
  const compra = senal && !comprada && !cautela && !pausada;
  const pausaNivel = datos.niveles.find((n) => n.tipo === "pausa" && n.estado !== "rota" && isFinite(n.min));
  const pausa = pausaNivel && ind.ayer && v.close < pausaNivel.min && ind.ayer.close >= pausaNivel.min ? pausaNivel : null;
  return {
    zona: zona,
    rota: rota,
    zonaRota: zonaRota,
    comprada: comprada,
    margen: margen,
    toqueBanda: toqueBanda,
    mecha: mecha,
    cuerpo: cuerpo,
    posCierre: posCierre,
    mechaOk: mechaOk,
    rechazo: rechazo,
    confirmacion: confirmacion,
    capitulacion: capitulacion,
    cerca200: cerca200,
    bajista: bajista,
    mult: mult,
    senal: senal,
    cautela: cautela,
    pausada: pausada,
    compra: compra,
    fuerte: compra && mult >= 2,
    importeWidget: compra ? (mult >= 2 ? 40 : 20) : 0,
    pausa: pausa
  };
}

// Calendario macro automático (vigilancia/calendario.json): IPC, empleo, PCE y Fed con su hora de España.
let calendarioAuto = [];
try { calendarioAuto = JSON.parse(localStorage.getItem("btczonas.calendario") || "[]"); } catch (e) { calendarioAuto = []; }

async function leerCalendario() {
  try {
    const r = await fetch("vigilancia/calendario.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    if (Array.isArray(j.eventos)) {
      calendarioAuto = j.eventos.map((e, i) => Object.assign({ id: "auto-" + i, auto: true }, e));
      try { localStorage.setItem("btczonas.calendario", JSON.stringify(calendarioAuto)); } catch (e) {}
      pintarEventos();
      pintarAnalisis();
    }
  } catch (e) {}
}

function eventosOrdenados() {
  const vistos = new Set(calendarioAuto.map((e) => e.fecha + " " + (e.hora || "00:00")));
  return calendarioAuto.concat(datos.eventos.filter((e) => !vistos.has(e.fecha + " " + (e.hora || "00:00"))))
    .map((e) => Object.assign({}, e, { ts: Date.parse(e.fecha + "T" + (e.hora || "00:00")) }))
    .filter((e) => isFinite(e.ts))
    .sort((a, b) => a.ts - b.ts);
}

function eventoProximo(horas) {
  const ahora = Date.now();
  return eventosOrdenados().find((e) => e.ts - ahora > -3600000 && e.ts - ahora <= horas * 3600000) || null;
}

function cuandoEvento(e) {
  const d = new Date(e.ts);
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) + " " + (e.hora || "");
}

function liquidezMarcada() {
  try {
    return localStorage.getItem(CLAVE_LIQUIDEZ) === "si";
  } catch (e) {
    return false;
  }
}

function importeRecomendado(ind, s) {
  if (!s.senal) return { importe: 0, texto: "Sin señal provisional: no corresponde compra." };
  if (s.pausada && !s.comprada) return { importe: 0, texto: "Compras en pausa: reanuda en Bitácora → Sistema si procede." };
  if (s.comprada) return { importe: 0, texto: s.zona.nombre + " ya está comprada: una compra por zona." };
  if (s.cautela) return { importe: 0, texto: "Señal con cautela (tendencia bajista sin capitulación ni 200 semanas): no se compra." };
  let base = 20;
  let calidad = "normal";
  if (s.cerca200 && s.capitulacion) {
    base = 50;
    calidad = "capitulación y 200 semanas";
  } else if (s.mult >= 2) {
    base = 40;
    calidad = s.cerca200 ? "200 semanas" : "capitulación";
  }
  const entrada = ind.hoy.close;
  const invalidacion = s.zona.min;
  const distancia = entrada > invalidacion ? (entrada - invalidacion) / entrada : 0;
  const tope = distancia > 0 ? 2.5 / distancia : Infinity;
  let importe = Math.min(base, tope);
  const recortes = [];
  const ev = eventoProximo(24);
  if (ev) {
    importe /= 2;
    recortes.push("dato macro en menos de 24 h (" + ev.nombre + ")");
  }
  if (miedo.valor > 75) {
    importe /= 2;
    recortes.push("codicia por encima de 75");
  }
  if (liquidezMarcada()) {
    importe /= 2;
    recortes.push("liquidez sin barrer debajo");
  }
  const redondeado = Math.floor(importe / 5) * 5;
  const partes = [
    "calidad: " + calidad + " (" + base + " €)",
    "riesgo hasta " + s.zona.nombre + " " + miles(invalidacion) + " €: " + fmtPct(-distancia * 100) + (isFinite(tope) ? " → tope " + Math.floor(tope) + " €" : ""),
    recortes.length ? "recortes: " + recortes.join(", ") : "sin recortes"
  ];
  const detalles = [
    ["Calidad", calidad + " (máx. " + base + " €)"],
    ["Riesgo hasta " + s.zona.nombre + " (" + miles(invalidacion) + " €)", (distancia * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " %" + (isFinite(tope) ? " → máx. " + Math.floor(tope) + " €" : "")],
    ["Recortes", recortes.length ? recortes.join(", ") : "ninguno"]
  ];
  if (redondeado < 20) {
    return { importe: 0, detalles: detalles, texto: "Sale " + Math.floor(importe) + " €: menos de 20 €, no compensa por la comisión. " + partes.join(" · ") };
  }
  return { importe: redondeado, detalles: detalles, texto: partes.join(" · ") };
}

function marca(ok) {
  return ok ? "<span class=\"sube\">✔</span>" : "<span class=\"baja\">✖</span>";
}

function filaHtml(izquierda, derecha, clase) {
  return "<div class=\"item\"><span>" + izquierda + "</span><span" + (clase ? " class=\"" + clase + "\"" : "") + ">" + derecha + "</span></div>";
}

function distanciaA(valor) {
  if (!isFinite(valor) || !isFinite(mercado.eur)) return "";
  return " (" + fmtPct((mercado.eur / valor - 1) * 100) + ")";
}

function indicadoresCerrada() {
  const ahora = Date.now() / 1000;
  const cerradas = ana.d.filter((x) => x.time + 86400 <= ahora);
  if (cerradas.length < 30) return null;
  const original = ana.d;
  ana.d = cerradas;
  try {
    return indicadores(cerradas[cerradas.length - 1].close);
  } finally {
    ana.d = original;
  }
}

function resumenCerrada() {
  const ind = indicadoresCerrada();
  if (!ind) return null;
  const s = evaluarSenal(ind);
  const imp = importeRecomendado(ind, s);
  let resultado = "Sin señal";
  if (s.rota) resultado = (s.zonaRota ? s.zonaRota.nombre : "Zona") + " rota";
  else if (s.compra) resultado = (s.fuerte ? "Señal FUERTE" : "Señal normal") + " en " + s.zona.nombre;
  else if (s.senal && s.pausada && !s.comprada) resultado = "Señal en pausa: no se compra";
  else if (s.cautela) resultado = "Con cautela: no se compra";
  else if (s.senal && s.comprada) resultado = s.zona.nombre + " ya comprada";
  if (s.pausa) resultado += " · pausa";
  return { ind: ind, s: s, imp: imp, resultado: resultado, fecha: fechaBonita(new Date(ind.hoy.time * 1000).toISOString().slice(0, 10)) };
}

function pintarCerrada() {
  const el = $("a-cerrada");
  if (!el) return;
  const r = resumenCerrada();
  if (!r) {
    el.innerHTML = "<div class=\"vacio\">Cargando velas…</div>";
    return;
  }
  $("a-cerrada-fecha").textContent = r.fecha;
  const v = r.ind.hoy;
  const clase = r.s.compra ? "sube" : r.s.rota || r.s.pausa ? "baja" : "";
  let html = filaHtml("<b>Resultado</b>", "<b>" + esc(r.resultado) + "</b>", clase);
  if (r.s.compra) {
    html += filaHtml("Importe del widget", r.s.importeWidget + " €");
    html += filaHtml("Importe regla nueva", r.imp.importe ? r.imp.importe + " €" : "no compra", r.imp.importe ? "sube" : "");
  }
  html += filaHtml("Cierre · mínimo", miles(v.close) + " · " + miles(v.low) + " €");
  html += filaHtml("Rechazo · confirmación", (r.s.rechazo ? "sí" : "no") + " (cierre al " + Math.round(r.s.posCierre * 100) + " %) · " + (r.s.confirmacion ? "sí" : "no") + " (RSI " + r.ind.rsiD.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + ")");
  html += filaHtml("Fuerza", "200 semanas " + marca(r.s.cerca200) + " · capitulación " + marca(r.s.capitulacion) + " (volumen " + r.ind.volRel.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + "×)");
  html += "<div class=\"vacio\">Confírmalo siempre en el widget (tócalo para actualizarlo).</div>";
  el.innerHTML = html;
}

function pintarAnalisis() {
  const elSenal = $("a-senal");
  if (!elSenal) return;
  $("a-cierre").textContent = $("p-cierre").textContent ? "cierra en " + $("p-cierre").textContent : "";
  const ind = indicadores();
  if (!ind) {
    const msg = "<div class=\"vacio\">" + esc(ana.error || "Cargando velas de Kraken…") + "</div>";
    elSenal.innerHTML = msg;
    $("a-importe").innerHTML = msg;
    $("a-indicadores").innerHTML = msg;
  } else {
    const s = evaluarSenal(ind);
    const v = ind.hoy;
    let html = "";
    if (s.zona) {
      html += filaHtml("Zona", "Toca " + esc(s.zona.nombre) + " (" + rangoTexto(s.zona) + " €, margen ±" + miles(s.margen) + " €)" + (s.comprada ? " · ya comprada" : "") + " " + marca(!s.comprada));
    } else if (s.rota) {
      html += filaHtml("Zona", "Cerraría por debajo de " + esc(s.zonaRota.nombre) + ": se rompería " + marca(false));
    } else {
      html += filaHtml("Zona", "No toca ninguna zona activa " + marca(false));
    }
    const detalleRechazo = (s.toqueBanda ? "bajó de la banda (" + miles(ind.bbInf) + " €) y cierra dentro" : "sin rechazo en la banda (" + miles(ind.bbInf) + " €)") +
      " · mecha " + fmtPct((s.mecha / v.close) * 100).replace("+", "") + (s.mecha > s.cuerpo ? " > cuerpo" : " ≤ cuerpo") +
      " · cierre al " + (isFinite(s.posCierre) ? Math.round(s.posCierre * 100) : "—") + " % del rango";
    html += filaHtml("Rechazo", detalleRechazo + " " + marca(s.rechazo));
    html += filaHtml("Confirmación", "RSI " + ind.rsiD.toLocaleString("es-ES", { maximumFractionDigits: 1 }) +
      " · volumen " + ind.volRel.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + "× " + marca(s.confirmacion));
    html += filaHtml("Fuerza", "200 semanas (≤ 3 %) " + marca(s.cerca200) + " · capitulación " + marca(s.capitulacion) + " · tendencia " + (s.bajista ? "bajista" : "normal"));
    html += filaHtml("ADX > 25 <span class=\"sec\">en observación, no decide</span>", ind.adx.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " " + marca(ind.adx > 25));
    let resultado = "Sin señal";
    let clase = "baja";
    if (s.senal && s.pausada && !s.comprada) {
      resultado = "Señal en pausa: no se compra";
    } else if (s.senal && s.comprada) {
      resultado = s.zona.nombre + " ya comprada";
    } else if (s.cautela) {
      resultado = "Con cautela: no se compra";
    } else if (s.compra) {
      resultado = s.fuerte ? "Señal FUERTE (provisional)" : "Señal normal (provisional)";
      clase = "sube";
    }
    html += filaHtml("<b>Resultado</b>", "<b>" + resultado + "</b>", clase);
    if (s.pausa) html += filaHtml("Pausa", "Cerraría por debajo de " + miles(s.pausa.min) + " €: el widget se pausaría", "baja");
    for (const r of infoRearme()) {
      html += filaHtml("Rearme " + esc(r.zona.nombre), "si cierra bajo " + miles(r.umbral) + " € y sobre " + miles(r.suelo) + " € (compra a " + miles(Number(r.compra.precio)) + " €)");
    }
    html += "<div class=\"vacio\">Misma lógica que el widget (modelo v2). El volumen es parcial hasta el cierre. La app no conoce tu espera entre compras: si el widget la tiene activa, manda el widget.</div>";
    elSenal.innerHTML = html;

    const imp = importeRecomendado(ind, s);
    const widget = s.importeWidget;
    $("a-importe").innerHTML =
      filaHtml("Widget (regla actual)", widget ? widget + " €" : "—") +
      filaHtml("Regla nueva (hasta 50 €)", imp.importe ? "<b>" + imp.importe + " €</b>" : "—", imp.importe ? "sube" : "") +
      (imp.detalles
        ? imp.detalles.map((d) => filaHtml("<span class=\"sec\">" + esc(d[0]) + "</span>", "<span class=\"sec\">" + esc(d[1]) + "</span>")).join("")
        : "<div class=\"vacio\">" + esc(imp.texto) + "</div>");

    const f1 = (x) => x.toLocaleString("es-ES", { maximumFractionDigits: 1 });
    $("a-indicadores").innerHTML =
      filaHtml("RSI diario · semanal", f1(ind.rsiD) + " · " + f1(ind.rsiW)) +
      filaHtml("Bollinger diario", miles(ind.bbInf) + " / " + miles(ind.bbMed) + " / " + miles(ind.bbSup) + " €") +
      filaHtml("Volumen hoy <span class=\"sec\">media 20 d " + f1(ind.volMedia) + " BTC</span>", f1(v.vol) + " BTC (" + ind.volRel.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + "×)") +
      filaHtml("ADX 14 <span class=\"sec\">en observación</span>", f1(ind.adx) + (ind.adx > 40 ? " · tendencia muy fuerte" : ind.adx > 25 ? " · tendencia fuerte" : " · tendencia débil"), ind.adx > 25 ? "sube" : "") +
      filaHtml("Media 200 días", fmtEur(ind.ma200d) + distanciaA(ind.ma200d)) +
      filaHtml("Media 20 semanas", fmtEur(ind.ma20w) + distanciaA(ind.ma20w)) +
      filaHtml("Media 200 semanas", fmtEur(ind.ma200w) + distanciaA(ind.ma200w)) +
      filaHtml("Retroceso desde máx. 182 días", f1(ind.retroceso) + " % (máx. " + miles(ind.max182) + " €)");
  }

  const elDer = $("a-derivados");
  $("a-der-act").textContent = der.actualizado ? der.actualizado.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—";
  if (!der.datos) {
    elDer.innerHTML = "<div class=\"vacio\">" + esc(der.error || "Cargando derivados…") + "</div>";
  } else {
    const d = der.datos;
    const pct = (x, dec) => (isFinite(x) ? fmtPct(x, dec) : "—");
    elDer.innerHTML =
      filaHtml("Financiación <span class=\"sec\">cada 8 h</span>", pct(d.financiacion, 4), d.financiacion > 0 ? "" : "sube") +
      filaHtml("Interés abierto", isFinite(d.oi) ? (d.oi / 1e9).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " mil M$ (" + pct(d.oiCambio) + " en 24 h)" : "—") +
      filaHtml("Cuentas en largo", isFinite(d.cuentasLargo) ? d.cuentasLargo.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " %" : "—") +
      filaHtml("Grandes traders en largo <span class=\"sec\">posición</span>", isFinite(d.topLargo) ? d.topLargo.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " %" : "—") +
      filaHtml("Compras / ventas agresivas <span class=\"sec\">24 h</span>", isFinite(d.agresivos) ? d.agresivos.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : "—", d.agresivos >= 1 ? "sube" : "baja") +
      filaHtml("Prima de Coinbase", pct(d.primaCoinbase, 3), d.primaCoinbase >= 0 ? "sube" : "baja");
  }

  pintarCerrada();
  pintarFib();
  pintarEscenarios();
  pintarSimulacion();
  pintarEventos();
}

async function actualizarDerivados() {
  const r = await Promise.allSettled([
    getJSON("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT"),
    getJSON("https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=25"),
    getJSON("https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1"),
    getJSON("https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=BTCUSDT&period=1h&limit=1"),
    getJSON("https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=1h&limit=24"),
    getJSON("https://api.exchange.coinbase.com/products/BTC-USD/ticker"),
    getJSON("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
  ]);
  const valor = (i) => (r[i].status === "fulfilled" ? r[i].value : null);
  const d = {};
  const pi = valor(0);
  if (pi && isFinite(Number(pi.lastFundingRate))) d.financiacion = Number(pi.lastFundingRate) * 100;
  const oi = valor(1);
  if (Array.isArray(oi) && oi.length >= 2) {
    const a = Number(oi[0].sumOpenInterestValue);
    const b = Number(oi[oi.length - 1].sumOpenInterestValue);
    d.oi = b;
    d.oiCambio = (b / a - 1) * 100;
  }
  const ls = valor(2);
  if (Array.isArray(ls) && ls[0]) d.cuentasLargo = Number(ls[0].longAccount) * 100;
  const tp = valor(3);
  if (Array.isArray(tp) && tp[0]) d.topLargo = Number(tp[0].longAccount) * 100;
  const tk = valor(4);
  if (Array.isArray(tk) && tk.length) {
    let compras = 0;
    let ventas = 0;
    for (const x of tk) {
      compras += Number(x.buyVol);
      ventas += Number(x.sellVol);
    }
    d.agresivos = ventas > 0 ? compras / ventas : NaN;
  }
  const cb = valor(5);
  const bn = valor(6);
  if (cb && bn && Number(bn.price) > 0) d.primaCoinbase = (Number(cb.price) / Number(bn.price) - 1) * 100;
  if (Object.keys(d).length) {
    der.datos = d;
    der.actualizado = new Date();
    der.error = "";
  } else {
    der.error = "No se pudieron cargar los derivados.";
  }
  pintarAnalisis();
}

function pintarEventos() {
  const el = $("l-eventos");
  if (!el) return;
  const lista = eventosOrdenados().filter((e) => e.ts > Date.now() - 3 * 86400000 && (!e.auto || e.ts < Date.now() + 45 * 86400000));
  if (lista.length === 0) {
    el.innerHTML = "<div class=\"vacio\">No hay datos macro apuntados.</div>";
    return;
  }
  const ahora = Date.now();
  el.innerHTML = lista.map((e) => {
    const horas = (e.ts - ahora) / 3600000;
    let estado = "";
    if (horas < -1) estado = "<span class=\"etiqueta rota\">Pasado</span>";
    else if (horas <= 24) estado = "<span class=\"etiqueta comprada\">En " + Math.max(0, Math.round(horas)) + " h</span>";
    return "<div class=\"registro\">" +
      "<div class=\"titulo\"><span>" + esc(e.nombre) + "</span>" + estado + "</div>" +
      "<div class=\"detalle\">" + esc(cuandoEvento(e)) + "</div>" +
      (e.auto
        ? "<div class=\"detalle\">Automático · fuente oficial</div>"
        : "<div class=\"acciones\"><button type=\"button\" class=\"peligro\" data-borrar-evento=\"" + esc(e.id) + "\">Borrar</button></div>") +
    "</div>";
  }).join("");
}

function guardarEvento(ev) {
  ev.preventDefault();
  const fecha = $("e-fecha").value;
  const hora = $("e-hora").value || "00:00";
  const nombre = $("e-nombre").value.trim();
  if (!fecha || !nombre) {
    $("e-error").textContent = "Pon la fecha y el nombre del dato.";
    return;
  }
  $("e-error").textContent = "";
  datos.eventos.push({ id: nuevoId(), fecha: fecha, hora: hora, nombre: nombre });
  if (guardar()) {
    $("e-nombre").value = "";
    avisoTemporal("Dato macro guardado.", "ok");
    pintarEventos();
    revisarAvisos();
    pintarAnalisis();
  }
}

function borrarEvento(id) {
  if (!window.confirm("¿Borrar este dato macro?")) return;
  datos.eventos = datos.eventos.filter((e) => e.id !== id);
  if (guardar()) {
    pintarEventos();
    revisarAvisos();
    pintarAnalisis();
  }
}

function textoParaClaude() {
  const ahora = new Date();
  const l = [];
  const f1 = (x) => (isFinite(x) ? x.toLocaleString("es-ES", { maximumFractionDigits: 1 }) : "—");
  l.push("BTC Zonas · " + ahora.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " (hora de España)");
  l.push("Precio: " + fmtEur(mercado.eur) + " (" + (mercado.fuente || "—") + ") · " + miles(mercado.usd) + " $ · 24 h " + fmtPct(mercado.cambio24));
  const rc = resumenCerrada();
  if (rc) l.push("Última vela cerrada (" + rc.fecha + "): " + rc.resultado + " · cierre " + miles(rc.ind.hoy.close) + " · mínimo " + miles(rc.ind.hoy.low) + (rc.s.compra ? " · widget " + rc.s.importeWidget + " € · regla nueva " + (rc.imp.importe ? rc.imp.importe + " €" : "no compra") : "") + " · RSI " + rc.ind.rsiD.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " · volumen " + rc.ind.volRel.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + "×");
  const ind = indicadores();
  if (ind) {
    const v = ind.hoy;
    const s = evaluarSenal(ind);
    l.push("Vela diaria en curso (cierra en " + $("p-cierre").textContent + "): apertura " + miles(v.open) + " · máx " + miles(v.high) + " · mín " + miles(v.low) + " · actual " + miles(v.close) + " · volumen " + f1(v.vol) + " BTC (" + ind.volRel.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + "× media 20 d)");
    l.push("ADX 14 (en observación): " + f1(ind.adx));
    l.push("RSI diario " + f1(ind.rsiD) + " · RSI semanal " + f1(ind.rsiW) + " · Bollinger diario " + miles(ind.bbInf) + " / " + miles(ind.bbMed) + " / " + miles(ind.bbSup));
    l.push("Medias: 200 d " + miles(ind.ma200d) + distanciaA(ind.ma200d) + " · 20 sem " + miles(ind.ma20w) + distanciaA(ind.ma20w) + " · 200 sem " + miles(ind.ma200w) + distanciaA(ind.ma200w));
    l.push("Retroceso desde máx. 182 d (" + miles(ind.max182) + "): " + f1(ind.retroceso) + " %");
    const fc = fibCiclo();
    l.push("Fibonacci del ciclo (0 % máx. " + miles(fc.alto) + " · 100 % mín. " + miles(fc.bajo) + "): " + fc.niveles.map((n) => pctFib(n.r) + " " + miles(n.p) + " " + papelFib(n.p) + (zonaDeFib(n.p) ? " (" + zonaDeFib(n.p) + ")" : "")).join(" · "));
    const fib = fibonacci();
    if (fib) l.push("Fibonacci 6 meses (" + (fib.sube ? "subida" : "bajada") + ", 0 % arriba " + miles(fib.alto) + " · 100 % abajo " + miles(fib.bajo) + "): " + fib.niveles.map((n) => pctFib(n.r) + " " + miles(n.p) + " " + papelFib(n.p) + (zonaDeFib(n.p) ? " (" + zonaDeFib(n.p) + ")" : "")).join(" · "));
    l.push("Señal provisional: zona " + (s.zona ? s.zona.nombre + (s.rota ? " (cerraría rota)" : "") : "ninguna") +
      " · rechazo " + (s.rechazo ? "sí" : "no") + " (banda " + (s.toqueBanda ? "sí" : "no") + ", mecha " + f1((s.mecha / v.close) * 100) + " %, cierre al " + (isFinite(s.posCierre) ? Math.round(s.posCierre * 100) : "—") + " % del rango)" +
      " · confirmación " + (s.confirmacion ? "sí" : "no") +
      " · 200 sem (≤3 %) " + (s.cerca200 ? "sí" : "no") + " · capitulación " + (s.capitulacion ? "sí" : "no") + " · tendencia " + (s.bajista ? "bajista" : "normal") +
      " → " + (s.compra ? (s.fuerte ? "FUERTE" : "normal") : s.cautela ? "con cautela (no se compra)" : s.comprada ? "zona ya comprada" : "sin señal") + (s.pausa ? " · cerraría bajo la pausa" : ""));
    const imp = importeRecomendado(ind, s);
    l.push("Importe: widget " + (s.importeWidget ? s.importeWidget + " €" : "—") + " · regla nueva " + (imp.importe ? imp.importe + " €" : "—") + " (" + imp.texto + ")");
  } else {
    l.push("Indicadores: sin datos de velas.");
  }
  l.push("Miedo y codicia: " + (isFinite(miedo.valor) ? miedo.valor + " " + miedo.texto : "—") + " · ayer " + (miedo.ayer || "—") + " · hace 7 d " + (miedo.semana || "—"));
  if (der.datos) {
    const d = der.datos;
    l.push("Derivados Binance: financiación " + (isFinite(d.financiacion) ? fmtPct(d.financiacion, 4) : "—") + "/8 h · interés abierto " + (isFinite(d.oi) ? (d.oi / 1e9).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " mil M$ (" + fmtPct(d.oiCambio) + " 24 h)" : "—") +
      " · cuentas en largo " + f1(d.cuentasLargo) + " % · grandes traders en largo " + f1(d.topLargo) + " % · compras/ventas agresivas 24 h " + (isFinite(d.agresivos) ? d.agresivos.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : "—") +
      " · prima Coinbase " + (isFinite(d.primaCoinbase) ? fmtPct(d.primaCoinbase, 3) : "—"));
  }
  if (mostrarLiq && liq.niveles.length) {
    const P = liq.precioUsd;
    const f = factorEur();
    const abajo = [1, 3, 5].map((x) => millones(sumaLiq("largo", P * (1 - x / 100), P))).join(" / ");
    const arriba = [1, 3, 5].map((x) => millones(sumaLiq("corto", P, P * (1 + x / 100)))).join(" / ");
    const g = (n, lado) => (n ? (isFinite(f) ? miles(n.precio * f) + " €" : miles(n.precio) + " $") + " (" + fmtPct((n.precio / P - 1) * 100) + ", " + millones(n[lado]) + ")" : "—");
    l.push("Liquidaciones estimadas 7 d (modelo propio): si baja 1/3/5 % " + abajo + " · si sube 1/3/5 % " + arriba + " · mayor grupo debajo " + g(mayorGrupo("largo"), "largo") + " · encima " + g(mayorGrupo("corto"), "corto"));
  }
  const zonas = datos.niveles.slice().sort((a, b) => b.min - a.min).map((n) => n.nombre + " " + rangoTexto(n) + " " + (NOMBRE_ESTADO[n.estado] || n.estado).toLowerCase());
  l.push("Niveles: " + zonas.join(" · "));
  const rearmes = infoRearme().map((r) => r.zona.nombre + " se rearma si cierra bajo " + miles(r.umbral) + " € y sobre " + miles(r.suelo) + " €");
  if (rearmes.length) l.push("Rearme: " + rearmes.join(" · "));
  const proximos = eventosOrdenados().filter((e) => e.ts > Date.now() - 3600000).slice(0, 4).map((e) => e.nombre + " " + cuandoEvento(e));
  const pv = pausaActiva();
  l.push("Sistema: compras " + (pv ? "EN PAUSA desde el " + fechaBonita(pv.fecha) : "activas") + " · vigilancia " + (vig.estado && vig.estado.sincronizado && vig.estado.sincronizado.ts >= (Number(leerLocal(CLAVE_ULTIMO_ENVIO)) || 0) ? "al día" : "pendiente de sincronizar"));
  l.push("Datos macro apuntados: " + (proximos.length ? proximos.join(" · ") : "ninguno"));
  const r = resumenCartera();
  const valorActual = r.btc * mercado.eur;
  l.push("Cartera: " + fmtBtc(r.btc) + " BTC · invertido " + fmtEur(r.total, 2) + " · precio medio " + fmtEur(r.medio) + " · resultado " + fmtEur(valorActual - r.total, 2) + " (" + fmtPct(((valorActual - r.total) / r.total) * 100) + ")");
  return l.join("\n");
}

async function copiarParaClaude() {
  const texto = textoParaClaude();
  let copiado = false;
  try {
    await navigator.clipboard.writeText(texto);
    copiado = true;
  } catch (e) {
    const t = document.createElement("textarea");
    t.value = texto;
    t.setAttribute("readonly", "");
    t.style.position = "absolute";
    t.style.left = "-9999px";
    document.body.appendChild(t);
    t.select();
    try {
      copiado = document.execCommand("copy");
    } catch (e2) {
      copiado = false;
    }
    t.remove();
  }
  const caja = $("copiar-texto");
  if (copiado) {
    $("copiar-estado").textContent = "Copiado. Pégalo en el chat con Claude.";
    caja.classList.add("oculto");
  } else {
    $("copiar-estado").textContent = "No se pudo copiar solo: mantén pulsado el texto, Seleccionar todo y Copiar.";
    caja.value = texto;
    caja.classList.remove("oculto");
  }
}

/* ---------- simulador de escenarios al cierre ---------- */

const HISTORIAL = {
  fuerte: { casos: 57, baja5: 65, sube5: 63, arriba7: 58, arriba30: 53, arriba90: 68, mediana90: 11.2 },
  normal: { casos: 66, baja5: 73, sube5: 53, arriba7: 47, arriba30: 52, arriba90: 47, mediana90: -7.8 }
};

function normalAcum(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

function volatilidadDiaria() {
  const c = ana.d.slice(-31).map((x) => x.close);
  const r = [];
  for (let i = 1; i < c.length; i++) r.push(Math.log(c[i] / c[i - 1]));
  if (r.length < 10) return NaN;
  const m = r.reduce((s, x) => s + x, 0) / r.length;
  return Math.sqrt(r.reduce((s, x) => s + (x - m) * (x - m), 0) / (r.length - 1));
}

function resultadoEn(precio) {
  const ind = indicadores(precio);
  if (!ind) return null;
  const s = evaluarSenal(ind);
  const imp = importeRecomendado(ind, s);
  let texto = "Sin señal";
  let tipo = "nada";
  if (s.rota) {
    texto = (s.zonaRota ? s.zonaRota.nombre : "Zona") + " rota";
    tipo = "rota";
  } else if (s.compra) {
    texto = (s.fuerte ? "FUERTE" : "Normal") + " · widget " + s.importeWidget + " € · regla " + (imp.importe ? imp.importe + " €" : "no compra");
    tipo = s.fuerte ? "fuerte" : "normal";
  } else if (s.senal && s.pausada && !s.comprada) {
    texto = "En pausa: no se compra";
  } else if (s.cautela) {
    texto = "Con cautela: no se compra";
  } else if (s.senal && s.comprada) {
    texto = "Zona ya comprada";
  }
  if (s.pausa) {
    texto += " · pausa";
    tipo = "rota";
  }
  return { texto: texto, tipo: tipo, s: s };
}

function pintarEscenarios() {
  const el = $("a-escenarios");
  if (!el) return;
  const ind = indicadores();
  const sigma = volatilidadDiaria();
  if (!ind || !isFinite(sigma) || !isFinite(mercado.eur)) {
    el.innerHTML = "<div class=\"vacio\">Cargando datos…</div>";
    return;
  }
  const p0 = mercado.eur;
  const quedan = Math.max(0, ind.hoy.time + 86400 - Date.now() / 1000);
  const s = Math.max(sigma * Math.sqrt(quedan / 86400), 0.0005);
  const paso = p0 * 0.0025;
  const desde = Math.floor(Math.min(p0 * Math.exp(-3.5 * s), ind.hoy.low * 0.98) / paso) * paso;
  const hasta = Math.ceil((p0 * Math.exp(3.5 * s)) / paso) * paso;
  const tramos = [];
  for (let p = desde; p <= hasta + 1; p += paso) {
    const r = resultadoEn(p);
    if (!r) continue;
    const u = tramos[tramos.length - 1];
    if (u && u.texto === r.texto) u.hasta = p;
    else tramos.push({ texto: r.texto, tipo: r.tipo, desde: p, hasta: p });
  }
  const prob = (a, b) => normalAcum(Math.log(b / p0) / s) - normalAcum(Math.log(a / p0) / s);
  const filas = tramos.reverse().map((t, i, lista) => {
    const arriba = i === 0 ? Infinity : t.hasta + paso / 2;
    const abajo = i === lista.length - 1 ? 0.000001 : t.desde - paso / 2;
    const pr = prob(abajo, arriba === Infinity ? p0 * 100 : arriba) * 100;
    const rango = i === 0 ? "más de " + miles(abajo) + " €" : i === lista.length - 1 ? "menos de " + miles(arriba) + " €" : miles(abajo) + "–" + miles(arriba) + " €";
    const clase = t.tipo === "fuerte" || t.tipo === "normal" ? "sube" : t.tipo === "rota" ? "baja" : "";
    return filaHtml("Cierre " + rango + " <span class=\"sec\">" + (pr < 1 ? "< 1" : Math.round(pr)) + " %</span>", esc(t.texto), clase);
  });
  const h = Math.floor(quedan / 3600);
  const m = Math.floor((quedan % 3600) / 60);
  let html = "<div class=\"vacio\">Precio " + fmtEur(p0) + " · cierre en " + h + " h " + String(m).padStart(2, "0") + " min · volatilidad diaria " + (sigma * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " %</div>" + filas.join("");
  const actual = resultadoEn(p0);
  if (actual && (actual.tipo === "fuerte" || actual.tipo === "normal")) {
    const hi = HISTORIAL[actual.tipo];
    html += "<div class=\"vacio\">Después de " + hi.casos + " señales " + (actual.tipo === "fuerte" ? "fuertes" : "normales") + " (2017–2026):</div>" +
      filaHtml("En 7 días baja un 5 % en algún momento", hi.baja5 + "\u00a0%") +
      filaHtml("En 7 días sube un 5 % en algún momento", hi.sube5 + "\u00a0%") +
      filaHtml("Más arriba a los 7 / 30 días", hi.arriba7 + "\u00a0% / " + hi.arriba30 + "\u00a0%") +
      filaHtml("Más arriba a los 90 días <span class=\"sec\">mediana " + fmtPct(hi.mediana90) + "</span>", hi.arriba90 + "\u00a0%", hi.arriba90 >= 60 ? "sube" : "baja");
  }
  el.innerHTML = html;
}

function pintarSimulacion() {
  const el = $("a-sim-res");
  if (!el) return;
  const p = num($("a-sim").value);
  if (!(p > 0)) {
    el.innerHTML = "<div class=\"vacio\">Escribe un precio para ver qué diría el sistema si la vela cerrara ahí.</div>";
    return;
  }
  const ind = indicadores(p);
  if (!ind) {
    el.innerHTML = "<div class=\"vacio\">Cargando datos…</div>";
    return;
  }
  const s = evaluarSenal(ind);
  const imp = importeRecomendado(ind, s);
  const r = resultadoEn(p);
  const clase = r.tipo === "fuerte" || r.tipo === "normal" ? "sube" : r.tipo === "rota" ? "baja" : "";
  let resultado = "Sin señal";
  if (s.rota) resultado = (s.zonaRota ? s.zonaRota.nombre : "Zona") + " rota";
  else if (s.compra) resultado = s.fuerte ? "Señal FUERTE" : "Señal normal";
  else if (s.cautela) resultado = "Con cautela: no se compra";
  else if (s.senal && s.comprada) resultado = "Zona ya comprada";
  let html = filaHtml("<b>Resultado</b>", "<b>" + esc(resultado) + "</b>", clase);
  if (s.compra) {
    html += filaHtml("Importe del widget", s.importeWidget + " €");
    html += filaHtml("Importe regla nueva", imp.importe ? imp.importe + " €" : "no compra", imp.importe ? "sube" : "");
    for (const d of imp.detalles || []) html += filaHtml("<span class=\"sec\">" + esc(d[0]) + "</span>", "<span class=\"sec\">" + esc(d[1]) + "</span>");
  }
  html += filaHtml("Zona · rechazo · confirmación", (s.zona ? esc(s.zona.nombre) : "—") + " · " + (s.rechazo ? "sí" : "no") + " · " + (s.confirmacion ? "sí" : "no"));
  html += filaHtml("RSI · cierre en el rango", ind.rsiD.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " · " + Math.round(s.posCierre * 100) + " %");
  if (s.compra) {
    const umbral = p * (1 - REARME);
    const zona = s.zona;
    const suelo = zona.min * (1 - MARGEN_REARME);
    html += "<div class=\"vacio\"><b>Si compras a " + miles(p) + " €</b></div>";
    html += umbral >= suelo
      ? filaHtml(esc(zona.nombre) + " se rearma si cierra entre", miles(suelo) + "\u00a0–\u00a0" + miles(umbral) + "\u00a0€")
      : filaHtml(esc(zona.nombre) + " se rearma", "no: un 5 % por debajo ya queda fuera de la zona");
    html += "<div class=\"vacio\">Rearmar no es comprar: la zona vuelve a estar disponible y solo habría otra compra con una señal nueva.</div>";
  }
  el.innerHTML = html;
}

/* ---------- zonas de las compras y rearme (igual que el widget) ---------- */

const REARME = 0.05;
const MARGEN_REARME = 0.015;
const CLAVE_REARME = "btczonas.rearme";

function opcionesZona(idSelect, porDefecto) {
  const sel = $(idSelect);
  if (!sel) return;
  const zonas = datos.niveles.filter((n) => n.tipo === "zona" && isFinite(n.min)).sort((a, b) => b.min - a.min);
  sel.innerHTML = "<option value=\"\">Ninguna</option>" + zonas.map((z) =>
    "<option value=\"" + esc(z.id) + "\">" + esc(z.nombre) + " · " + rangoTexto(z) + " € · " + esc((NOMBRE_ESTADO[z.estado] || z.estado).toLowerCase()) + "</option>").join("");
  sel.value = porDefecto && zonas.some((z) => z.id === porDefecto) ? porDefecto : "";
}

function zonaPorDefecto() {
  const ind = indicadores();
  if (ind) {
    const s = evaluarSenal(ind);
    if (s.zona) return s.zona.id;
  }
  const activa = datos.niveles.filter((n) => n.tipo === "zona" && n.estado === "activa").sort((a, b) => b.min - a.min)[0];
  return activa ? activa.id : "";
}

function marcarComprada(idZona) {
  const z = datos.niveles.find((n) => n.id === idZona);
  if (z) {
    z.estado = "comprada";
    z.editado = Date.now();
  }
}

function compraDeZona(idZona) {
  return datos.compras
    .filter((c) => c.zona === idZona && Number(c.precio) > 0)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0] || null;
}

function infoRearme() {
  return datos.niveles
    .filter((n) => n.tipo === "zona" && n.estado === "comprada")
    .map((z) => {
      const c = compraDeZona(z.id);
      if (!c) return null;
      return { zona: z, compra: c, umbral: Number(c.precio) * (1 - REARME), suelo: z.min * (1 - MARGEN_REARME) };
    })
    .filter(Boolean);
}

// Como el widget: una zona comprada vuelve a estar disponible si una vela cierra un 5 % por debajo
// de lo que pagaste y sigue dentro de la zona. Solo se revisan las velas cerradas desde la última revisión.
function revisarRearme() {
  const ahora = Date.now() / 1000;
  const cerradas = ana.d.filter((x) => x.time + 86400 <= ahora);
  if (cerradas.length === 0) return;
  let desde = NaN;
  try {
    desde = Number(localStorage.getItem(CLAVE_REARME));
  } catch (e) {
    desde = NaN;
  }
  const ultima = cerradas[cerradas.length - 1].time;
  if (!(desde > 0)) {
    try {
      localStorage.setItem(CLAVE_REARME, String(ultima));
    } catch (e) {
      /* sin almacenamiento */
    }
    return;
  }
  let cambio = false;
  for (const r of infoRearme()) {
    const compraTs = Date.parse(r.compra.fecha + "T00:00:00Z") / 1000;
    const v = cerradas.find((x) => x.time > desde && x.time >= compraTs && x.close < r.umbral && x.close >= r.suelo);
    if (v) {
      r.zona.estado = "activa";
      r.zona.editado = Date.now();
      r.zona.nota = (r.zona.nota ? r.zona.nota + ". " : "") + "Rearmada el " + fechaBonita(new Date(v.time * 1000).toISOString().slice(0, 10)) + " (cierre " + miles(v.close) + " €)";
      cambio = true;
      avisoTemporal(r.zona.nombre + " vuelve a estar disponible (rearme).", "ok");
    }
  }
  try {
    localStorage.setItem(CLAVE_REARME, String(ultima));
  } catch (e) {
    /* sin almacenamiento */
  }
  if (cambio && guardar()) refrescarTodo();
}

/* ---------- conexión con la vigilancia automática (un solo sistema) ----------
   La app manda una copia de tus zonas, niveles, eventos y niveles de rearme por un tema de control de ntfy
   (tu tema + "-control"); la vigilancia de GitHub la lee cada 30 minutos.
   La vigilancia publica su estado (zonas rotas, rearmes, pausa) en vigilancia/estado.json y la app lo lee.
   No viajan importes, cantidades ni la cartera. */

const CLAVE_TEMA = "btczonas.tema";
const CLAVE_REANUDAR = "btczonas.reanudar";
const CLAVE_ULTIMO_ENVIO = "btczonas.ultimoEnvio";
const vig = { estado: null, leido: null, error: "" };
let temporizadorSync = null;

function leerLocal(clave) {
  try {
    return localStorage.getItem(clave) || "";
  } catch (e) {
    return "";
  }
}

function escribirLocal(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch (e) {
    /* sin almacenamiento */
  }
}

function temaControl() {
  const t = leerLocal(CLAVE_TEMA).trim();
  return t ? t + "-control" : "";
}

function fotoParaVigilancia() {
  const zonas = datos.niveles
    .filter((n) => n.tipo === "zona" && isFinite(n.min))
    .map((z) => {
      const c = z.estado === "comprada" ? compraDeZona(z.id) : null;
      return {
        id: z.nombre,
        min: Math.round(z.min),
        max: Math.round(techo(z)),
        estado: z.estado,
        rearme: c ? { desde: c.fecha, umbral: Math.round(Number(c.precio) * (1 - REARME)) } : undefined
      };
    });
  const res = datos.niveles.find((n) => n.tipo === "resistencia" && n.estado !== "rota" && isFinite(n.min));
  const pausa = datos.niveles.find((n) => n.tipo === "pausa" && n.estado !== "rota" && isFinite(n.min));
  return {
    tipo: "sync",
    v: 1,
    ts: Date.now(),
    zonas: zonas,
    resistencia: res ? { min: Math.round(res.min), max: Math.round(techo(res)) } : null,
    pausa: pausa ? Math.round(pausa.min) : null,
    eventos: datos.eventos.map((e) => ({ fecha: e.fecha, hora: e.hora || "00:00", nombre: e.nombre })),
    reanudar: Number(leerLocal(CLAVE_REANUDAR)) || 0
  };
}

// Contenido comparable de una copia (sin la hora de envío): sirve para no reenviar lo mismo
// y para saber si la vigilancia ya tiene exactamente lo que hay en la app.
function contenidoSync(d) {
  if (!d) return "";
  const num = (x) => (x === null || x === undefined || x === "" || !isFinite(Number(x)) ? null : Math.round(Number(x)));
  return JSON.stringify({
    zonas: (d.zonas || []).map((z) => [String(z.id), num(z.min), num(z.max), z.estado, z.rearme ? [z.rearme.desde, num(z.rearme.umbral)] : null]),
    resistencia: d.resistencia ? [num(d.resistencia.min), num(d.resistencia.max)] : null,
    pausa: num(d.pausa),
    eventos: (d.eventos || []).map((e) => [e.fecha, e.hora || "00:00", e.nombre]),
    reanudar: Number(d.reanudar) || 0
  });
}

function vigilanciaAlDia() {
  const s = vig.estado && vig.estado.sincronizado;
  return !!s && contenidoSync(s) === contenidoSync(fotoParaVigilancia());
}

async function enviarAVigilancia(manual) {
  if (!manual && vigilanciaAlDia()) {
    pintarSistema();
    return true;
  }
  const tema = temaControl();
  if (!tema) {
    if (manual) avisoTemporal("Primero guarda tu tema de ntfy en Bitácora → Sistema.", "atento");
    pintarSistema();
    return false;
  }
  try {
    const r = await fetch("https://ntfy.sh/" + encodeURIComponent(tema), {
      method: "POST",
      body: JSON.stringify(fotoParaVigilancia())
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    escribirLocal(CLAVE_ULTIMO_ENVIO, String(Date.now()));
    if (manual) avisoTemporal("Enviado a la vigilancia. Lo aplicará en la próxima revisión (máx. 30 min).", "ok");
    pintarSistema();
    return true;
  } catch (e) {
    vig.error = "No se pudo enviar a ntfy (" + e.message + ").";
    if (manual) avisoTemporal(vig.error, "malo");
    pintarSistema();
    return false;
  }
}

function programarEnvio() {
  clearTimeout(temporizadorSync);
  temporizadorSync = setTimeout(() => enviarAVigilancia(false), 1500);
}

async function leerVigilancia() {
  try {
    const r = await fetch("vigilancia/estado.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    vig.estado = await r.json();
    vig.leido = new Date();
    vig.error = "";
    adoptarEstadoVigilancia();
  } catch (e) {
    vig.error = "No se pudo leer el estado de la vigilancia.";
  }
  pintarSistema();
  revisarAvisos();
}

// La vigilancia es quien detecta zonas rotas: si rompió una zona después de tu última edición, la app la marca rota.
function adoptarEstadoVigilancia() {
  const e = vig.estado;
  if (!e) return;
  let cambio = false;
  for (const [nombre, fecha] of Object.entries(e.rotas || {})) {
    const z = datos.niveles.find((n) => n.tipo === "zona" && n.nombre === nombre);
    if (!z || z.estado === "rota" || z.estado === "comprada") continue;
    const tRota = Date.parse(fecha + "T00:00:00Z") + 86400000;
    if (!(z.editado > tRota)) {
      z.estado = "rota";
      z.nota = (z.nota ? z.nota + ". " : "") + "Rota el " + fechaBonita(fecha) + " (vigilancia)";
      cambio = true;
    }
  }
  if (cambio && guardar()) refrescarTodo();
}

function pausaActiva() {
  const e = vig.estado;
  if (!e || !e.pausa) return null;
  const reanudar = Number(leerLocal(CLAVE_REANUDAR)) || 0;
  return reanudar > e.pausa.t * 1000 ? null : e.pausa;
}

function reanudarSistema() {
  const p = pausaActiva();
  if (!p) return;
  if (!window.confirm("Las compras están en pausa desde el " + fechaBonita(p.fecha) + " (cierre " + miles(p.cierre) + " €). ¿Has revisado el sistema y quieres reanudar?")) return;
  escribirLocal(CLAVE_REANUDAR, String(Date.now()));
  enviarAVigilancia(true);
  refrescarTodo();
}

function pintarSistema() {
  const el = $("sistema-estado");
  if (!el) return;
  const tema = leerLocal(CLAVE_TEMA);
  const enviado = Number(leerLocal(CLAVE_ULTIMO_ENVIO)) || 0;
  const sync = vig.estado && vig.estado.sincronizado ? vig.estado.sincronizado.ts : 0;
  let estadoSync = "Sin enviar todavía";
  let clase = "baja";
  if (!tema) estadoSync = "Falta el tema de ntfy";
  else if (vigilanciaAlDia() || (enviado && sync >= enviado)) {
    estadoSync = "Al día";
    clase = "sube";
  } else if (enviado) {
    estadoSync = "Enviado, pendiente de aplicar (máx. 30 min)";
    clase = "";
  }
  const p = pausaActiva();
  const ultima = vig.estado && vig.estado.ultimoCierre ? fechaBonita(new Date(vig.estado.ultimoCierre * 1000).toISOString().slice(0, 10)) : "—";
  const rotas = vig.estado ? Object.keys(vig.estado.rotas || {}).join(", ") : "";
  el.innerHTML =
    filaHtml("Vigilancia ↔ app", esc(estadoSync), clase) +
    filaHtml("Última vela revisada", esc(ultima)) +
    filaHtml("Compras", p ? "EN PAUSA desde el " + esc(fechaBonita(p.fecha)) : "activas", p ? "baja" : "sube") +
    (rotas ? filaHtml("Zonas rotas detectadas", esc(rotas)) : "") +
    (vig.error ? "<div class=\"vacio\">" + esc(vig.error) + "</div>" : "");
  const b = $("b-reanudar");
  if (b) b.classList.toggle("oculto", !p);
  const inp = $("s-tema");
  if (inp && !inp.value && tema) inp.value = tema;
}

function guardarTema() {
  const t = $("s-tema").value.trim();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(t)) {
    avisoTemporal("El tema solo puede tener letras, números, guiones y guiones bajos (6 a 64).", "malo");
    return;
  }
  escribirLocal(CLAVE_TEMA, t);
  enviarAVigilancia(true);
}

/* ---------- calculadora ---------- */

function botonesRapidos(contenedor, opciones, destino) {
  const el = $(contenedor);
  el.innerHTML = "";
  for (const o of opciones) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = o.texto;
    b.addEventListener("click", () => {
      $(destino).value = String(Math.round(o.valor));
      calcular();
    });
    el.appendChild(b);
  }
}

function prepararCalculadora() {
  opcionesZona("c-zona", zonaPorDefecto());
  const entrada = $("c-entrada");
  if (!entrada.value && isFinite(mercado.eur)) entrada.value = String(Math.round(mercado.eur));
  const inval = datos.niveles
    .filter((n) => isFinite(n.min) && n.estado === "activa" && (n.tipo === "zona" || n.tipo === "pausa" || n.tipo === "soporte"))
    .sort((a, b) => b.min - a.min)
    .map((n) => ({ texto: n.nombre + " " + miles(n.min), valor: n.min }));
  botonesRapidos("c-inval-rapidos", inval, "c-inval");
  const r = resumenCartera();
  const objetivos = datos.niveles
    .filter((n) => isFinite(n.min) && n.tipo === "resistencia" && n.estado !== "rota")
    .sort((a, b) => a.min - b.min)
    .map((n) => ({ texto: n.nombre + " " + miles(n.min), valor: n.min }));
  if (isFinite(r.medio)) objetivos.push({ texto: "Tu precio medio " + miles(r.medio), valor: r.medio });
  botonesRapidos("c-obj-rapidos", objetivos, "c-objetivo");
  calcular();
}

function calcular() {
  const out = $("c-resultado");
  const importe = num($("c-importe").value);
  const comision = num($("c-comision").value) || 0;
  const entrada = num($("c-entrada").value);
  const inval = num($("c-inval").value);
  const objetivo = num($("c-objetivo").value);

  if (!(importe > 0) || !(entrada > 0)) {
    out.innerHTML = "<div class=\"vacio\">Pon el importe y el precio de entrada.</div>";
    return null;
  }
  if (comision < 0 || comision >= importe) {
    out.innerHTML = "<div class=\"vacio baja\">La comisión tiene que ser menor que el importe.</div>";
    return null;
  }

  const btc = (importe - comision) / entrada;
  const costeReal = importe / btc;
  let html =
    "<div class=\"lista-simple\">" +
    "<div class=\"item\"><span>BTC que recibes</span><span>" + fmtBtc(btc) + "</span></div>" +
    "<div class=\"item\"><span>Coste real por BTC <span class=\"sec\">con comisión</span></span><span>" + fmtEur(costeReal) + "</span></div>";

  let perdida = NaN;
  let ganancia = NaN;
  if (isFinite(inval)) {
    if (inval >= entrada) {
      html += "<div class=\"item\"><span>Invalidación</span><span class=\"baja\">Debe estar por debajo de la entrada</span></div>";
    } else {
      perdida = importe - btc * inval;
      html += "<div class=\"item\"><span>Si llega a la invalidación</span><span class=\"baja\">−" + fmtEur(perdida, 2) + " (" + fmtPct(-(perdida / importe) * 100) + ")</span></div>";
    }
  }
  if (isFinite(objetivo)) {
    if (objetivo <= entrada) {
      html += "<div class=\"item\"><span>Objetivo</span><span class=\"baja\">Debe estar por encima de la entrada</span></div>";
    } else {
      ganancia = btc * objetivo - importe;
      html += "<div class=\"item\"><span>Si llega al objetivo</span><span class=\"" + (ganancia >= 0 ? "sube" : "baja") + "\">" + (ganancia >= 0 ? "+" : "") + fmtEur(ganancia, 2) + " (" + fmtPct((ganancia / importe) * 100) + ")</span></div>";
    }
  }
  if (isFinite(perdida) && isFinite(ganancia) && perdida > 0) {
    const ratio = ganancia / perdida;
    html += "<div class=\"item\"><span>Riesgo : beneficio</span><span class=\"" + (ratio >= 2 ? "sube" : (ratio >= 1 ? "" : "baja")) + "\">1 : " + ratio.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "</span></div>";
  }

  const r = resumenCartera();
  const btcTotal = r.btc + btc;
  const medioNuevo = (r.base + btc * entrada) / btcTotal;
  html += "<div class=\"item\"><span>Tu precio medio <span class=\"sec\">ahora → tras comprar</span></span><span>" +
    (isFinite(r.medio) ? miles(r.medio) + " → " : "") + fmtEur(medioNuevo) + "</span></div>";
  html += "</div>";
  out.innerHTML = html;
  return { importe: importe, comision: comision, entrada: entrada, btc: btc };
}

function registrarDesdeCalculadora() {
  const c = calcular();
  if (!c) {
    avisoTemporal("Completa el importe y el precio de entrada.", "atento");
    return;
  }
  const idZona = $("c-zona").value;
  const zona = datos.niveles.find((n) => n.id === idZona);
  const texto = "¿Registrar compra de " + fmtEur(c.importe, 2) + " a " + fmtEur(c.entrada) + " (" + fmtBtc(c.btc) + " BTC) con fecha de hoy" +
    (zona ? " en " + zona.nombre + "? La zona quedará como comprada." : ", sin zona?");
  if (!window.confirm(texto)) return;
  datos.compras.push({
    id: nuevoId(),
    fecha: hoyLocal(),
    precio: c.entrada,
    btc: Number(c.btc.toFixed(8)),
    total: c.importe,
    comision: c.comision,
    nota: zona ? zona.nombre : "",
    zona: idZona
  });
  if (idZona) marcarComprada(idZona);
  if (guardar()) {
    avisoTemporal("Compra registrada.", "ok");
    refrescarTodo();
  }
}

/* ---------- bitácora: niveles ---------- */

function limpiarFormNivel() {
  $("n-id").value = "";
  $("n-nombre").value = "";
  $("n-tipo").value = "zona";
  $("n-min").value = "";
  $("n-max").value = "";
  $("n-estado").value = "activa";
  $("n-nota").value = "";
  $("n-error").textContent = "";
  $("n-guardar").textContent = "Guardar nivel";
}

function guardarNivel(ev) {
  ev.preventDefault();
  const nombre = $("n-nombre").value.trim();
  const min = num($("n-min").value);
  const maxTexto = $("n-max").value.trim();
  const max = maxTexto === "" ? null : num(maxTexto);
  const error = $("n-error");
  if (!nombre) {
    error.textContent = "Pon un nombre.";
    return;
  }
  if (!(min > 0)) {
    error.textContent = "Pon un precio mínimo válido.";
    return;
  }
  if (max !== null && !(max > min)) {
    error.textContent = "El precio máximo tiene que ser mayor que el mínimo (o déjalo vacío).";
    return;
  }
  error.textContent = "";
  const id = $("n-id").value;
  const nivel = {
    id: id || nuevoId(),
    editado: Date.now(),
    nombre: nombre,
    tipo: $("n-tipo").value,
    min: min,
    max: max,
    estado: $("n-estado").value,
    nota: $("n-nota").value.trim()
  };
  const i = datos.niveles.findIndex((n) => n.id === id);
  if (i >= 0) datos.niveles[i] = nivel;
  else datos.niveles.push(nivel);
  if (guardar()) {
    avisoTemporal(i >= 0 ? "Nivel actualizado." : "Nivel guardado.", "ok");
    limpiarFormNivel();
    refrescarTodo();
  }
}

function editarNivel(id) {
  const n = datos.niveles.find((x) => x.id === id);
  if (!n) return;
  $("n-id").value = n.id;
  $("n-nombre").value = n.nombre;
  $("n-tipo").value = n.tipo;
  $("n-min").value = String(n.min);
  $("n-max").value = isFinite(n.max) && n.max !== null ? String(n.max) : "";
  $("n-estado").value = n.estado;
  $("n-nota").value = n.nota || "";
  $("n-error").textContent = "";
  $("n-guardar").textContent = "Actualizar nivel";
  $("f-nivel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function borrarNivel(id) {
  const n = datos.niveles.find((x) => x.id === id);
  if (!n || !window.confirm("¿Borrar " + n.nombre + "?")) return;
  datos.niveles = datos.niveles.filter((x) => x.id !== id);
  if (guardar()) refrescarTodo();
}

function pintarNiveles() {
  const el = $("l-niveles");
  if (datos.niveles.length === 0) {
    el.innerHTML = "<div class=\"vacio\">Todavía no hay niveles.</div>";
    return;
  }
  const ordenados = datos.niveles.slice().sort((a, b) => (Number(b.min) || 0) - (Number(a.min) || 0));
  el.innerHTML = ordenados.map((n) =>
    "<div class=\"registro\">" +
      "<div class=\"titulo\"><span>" + esc(n.nombre) + " · " + rangoTexto(n) + " €</span>" +
      "<span class=\"etiqueta " + esc(n.estado) + "\">" + esc(NOMBRE_ESTADO[n.estado] || n.estado) + "</span></div>" +
      "<div class=\"detalle\">" + esc(NOMBRE_TIPO[n.tipo] || n.tipo) + (n.nota ? " · " + esc(n.nota) : "") + "</div>" +
      "<div class=\"acciones\">" +
        "<button type=\"button\" data-editar-nivel=\"" + esc(n.id) + "\">Editar</button>" +
        "<button type=\"button\" class=\"peligro\" data-borrar-nivel=\"" + esc(n.id) + "\">Borrar</button>" +
      "</div>" +
    "</div>"
  ).join("");
}

/* ---------- bitácora: compras ---------- */

function guardarCompra(ev) {
  ev.preventDefault();
  const fecha = $("k-fecha").value;
  const precio = num($("k-precio").value);
  const total = num($("k-total").value);
  const comision = num($("k-comision").value) || 0;
  let btc = num($("k-btc").value);
  const error = $("k-error");
  if (!fecha) {
    error.textContent = "Pon la fecha.";
    return;
  }
  if (!(precio > 0)) {
    error.textContent = "Pon un precio válido.";
    return;
  }
  if (!(total > 0) || comision >= total) {
    error.textContent = "El total tiene que ser mayor que la comisión.";
    return;
  }
  if (!(btc > 0)) btc = (total - comision) / precio;
  error.textContent = "";
  datos.compras.push({
    id: nuevoId(),
    fecha: fecha,
    precio: precio,
    btc: Number(btc.toFixed(8)),
    total: total,
    comision: comision,
    nota: $("k-nota").value.trim(),
    zona: $("k-zona").value
  });
  if ($("k-zona").value) marcarComprada($("k-zona").value);
  if (guardar()) {
    avisoTemporal("Compra guardada.", "ok");
    $("k-precio").value = "";
    $("k-total").value = "";
    $("k-btc").value = "";
    $("k-nota").value = "";
    refrescarTodo();
  }
}

function borrarCompra(id) {
  const c = datos.compras.find((x) => x.id === id);
  if (!c || !window.confirm("¿Borrar la compra del " + fechaBonita(c.fecha) + "?")) return;
  datos.compras = datos.compras.filter((x) => x.id !== id);
  if (guardar()) refrescarTodo();
}

function pintarCompras() {
  opcionesZona("k-zona", $("k-zona") ? $("k-zona").value || zonaPorDefecto() : "");
  const el = $("l-compras");
  if (datos.compras.length === 0) {
    el.innerHTML = "<div class=\"vacio\">Todavía no hay compras.</div>";
    return;
  }
  const ordenadas = datos.compras.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  el.innerHTML = ordenadas.map((c) =>
    "<div class=\"registro\">" +
      "<div class=\"titulo\"><span>" + fechaBonita(c.fecha) + " · " + fmtEur(Number(c.precio)) + "</span><span>" + fmtEur(Number(c.total), 2) + "</span></div>" +
      "<div class=\"detalle\">" + (c.zona && datos.niveles.find((n) => n.id === c.zona) ? esc(datos.niveles.find((n) => n.id === c.zona).nombre) + " · " : "") + fmtBtc(Number(c.btc)) + " BTC · comisión " + fmtEur(Number(c.comision) || 0, 2) + (c.nota ? " · " + esc(c.nota) : "") + "</div>" +
      "<div class=\"acciones\"><button type=\"button\" class=\"peligro\" data-borrar-compra=\"" + esc(c.id) + "\">Borrar</button></div>" +
    "</div>"
  ).join("");
}

/* ---------- bitácora: notas ---------- */

function guardarNota(ev) {
  ev.preventDefault();
  const texto = $("t-nota").value.trim();
  if (!texto) {
    $("t-error").textContent = "Escribe algo antes de guardar.";
    return;
  }
  $("t-error").textContent = "";
  datos.notas.push({ id: nuevoId(), fecha: new Date().toISOString(), texto: texto });
  if (guardar()) {
    $("t-nota").value = "";
    avisoTemporal("Nota guardada.", "ok");
    pintarNotas();
  }
}

function borrarNota(id) {
  if (!window.confirm("¿Borrar esta nota?")) return;
  datos.notas = datos.notas.filter((x) => x.id !== id);
  if (guardar()) pintarNotas();
}

function pintarNotas() {
  const el = $("l-notas");
  if (datos.notas.length === 0) {
    el.innerHTML = "<div class=\"vacio\">Todavía no hay notas.</div>";
    return;
  }
  const ordenadas = datos.notas.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  el.innerHTML = ordenadas.map((n) => {
    const d = new Date(n.fecha);
    const cuando = isNaN(d) ? "" : d.toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return "<div class=\"registro\">" +
      "<div class=\"titulo\"><span class=\"etq\">" + esc(cuando) + "</span></div>" +
      "<div class=\"detalle\">" + esc(n.texto) + "</div>" +
      "<div class=\"acciones\"><button type=\"button\" class=\"peligro\" data-borrar-nota=\"" + esc(n.id) + "\">Borrar</button></div>" +
    "</div>";
  }).join("");
}

/* ---------- copia de seguridad ---------- */

async function exportar() {
  const texto = JSON.stringify({
    app: "btc-zonas",
    version: 1,
    exportado: new Date().toISOString(),
    niveles: datos.niveles,
    compras: datos.compras,
    notas: datos.notas,
    eventos: datos.eventos
  }, null, 2);
  const nombre = "btc-zonas-" + hoyLocal() + ".json";
  try {
    const archivo = new File([texto], nombre, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: nombre });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  setTimeout(() => {
    URL.revokeObjectURL(enlace.href);
    enlace.remove();
  }, 1500);
}

function importar(ev) {
  const archivo = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = () => {
    let d;
    try {
      d = JSON.parse(lector.result);
    } catch (e) {
      avisoTemporal("El archivo no es una copia válida.", "malo");
      return;
    }
    if (!d || (!Array.isArray(d.niveles) && !Array.isArray(d.compras) && !Array.isArray(d.notas))) {
      avisoTemporal("El archivo no es una copia de BTC Zonas.", "malo");
      return;
    }
    if (!window.confirm("Esto sustituye tus niveles, compras y notas actuales por los de la copia. ¿Continuar?")) return;
    datos = normalizar(d);
    if (guardar()) {
      avisoTemporal("Copia importada.", "ok");
      refrescarTodo();
    }
  };
  lector.readAsText(archivo);
}

function restaurarSistema() {
  if (!window.confirm("Esto sustituye tus datos actuales por las zonas y compras del sistema (24 nov 2026). ¿Continuar?")) return;
  datos = copiaSistema();
  if (guardar()) {
    avisoTemporal("Datos del sistema restaurados.", "ok");
    refrescarTodo();
  }
}

/* ---------- navegación ---------- */

function irA(vista) {
  if (!TITULOS[vista]) vista = "panel";
  document.querySelectorAll(".vista").forEach((s) => s.classList.toggle("activa", s.id === "v-" + vista));
  document.querySelectorAll(".barra-nav button").forEach((b) => b.classList.toggle("sel", b.dataset.vista === vista));
  $("titulo").textContent = TITULOS[vista];
  try {
    localStorage.setItem(CLAVE_VISTA, vista);
  } catch (e) {
    /* sin almacenamiento */
  }
  if (vista === "grafico") abrirGrafico();
  if (vista === "calc") prepararCalculadora();
  if (vista === "analisis") pintarAnalisis();
  window.scrollTo(0, 0);
}

function irASub(sub) {
  document.querySelectorAll(".subvista").forEach((s) => s.classList.toggle("activa", s.id === "sub-" + sub));
  document.querySelectorAll("#seg-bitacora button").forEach((b) => b.classList.toggle("sel", b.dataset.sub === sub));
}

function refrescarTodo() {
  pintarPanel();
  revisarAvisos();
  pintarNiveles();
  pintarCompras();
  pintarNotas();
  if (chart && velas.length) construirSeries();
  if ($("v-calc").classList.contains("activa")) prepararCalculadora();
  pintarAnalisis();
}

/* ---------- arranque ---------- */

let temporizadorPrecios = null;
let temporizadorMiedo = null;
let temporizadorLiq = null;
let temporizadorAnalisis = null;

function arrancarTemporizadores() {
  clearInterval(temporizadorPrecios);
  clearInterval(temporizadorMiedo);
  temporizadorPrecios = setInterval(actualizarPrecios, 60000);
  temporizadorMiedo = setInterval(actualizarMiedo, 30 * 60000);
  clearInterval(temporizadorLiq);
  temporizadorLiq = setInterval(calcularLiquidaciones, 10 * 60000);
  clearInterval(temporizadorAnalisis);
  temporizadorAnalisis = setInterval(() => {
    actualizarAnalisis();
    actualizarDerivados();
    leerVigilancia();
    leerCalendario();
  }, 5 * 60000);
}

function pararTemporizadores() {
  clearInterval(temporizadorPrecios);
  clearInterval(temporizadorMiedo);
  clearInterval(temporizadorLiq);
  clearInterval(temporizadorAnalisis);
}

function iniciar() {
  try {
    if (!localStorage.getItem(CLAVE)) guardar();
  } catch (e) {
    /* sin almacenamiento */
  }

  document.querySelectorAll(".barra-nav button").forEach((b) => b.addEventListener("click", () => irA(b.dataset.vista)));
  document.querySelectorAll("#seg-bitacora button").forEach((b) => b.addEventListener("click", () => irASub(b.dataset.sub)));
  document.querySelectorAll("#seg-intervalo button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#seg-intervalo button").forEach((x) => x.classList.toggle("sel", x === b));
    intervalo = Number(b.dataset.int);
    velas = [];
    cargarVelas();
  }));

  $("b-centrar").addEventListener("click", centrarGrafico);
  $("b-copiar").addEventListener("click", copiarParaClaude);
  $("b-tema").addEventListener("click", guardarTema);
  $("b-enviar").addEventListener("click", () => enviarAVigilancia(true));
  $("b-reanudar").addEventListener("click", reanudarSistema);
  $("a-sim").addEventListener("input", pintarSimulacion);
  $("f-evento").addEventListener("submit", guardarEvento);
  $("e-fecha").value = hoyLocal();
  $("a-liquidez").checked = liquidezMarcada();
  $("a-liquidez").addEventListener("change", (ev) => {
    try {
      localStorage.setItem(CLAVE_LIQUIDEZ, ev.target.checked ? "si" : "no");
    } catch (e) {
      /* sin almacenamiento */
    }
    pintarAnalisis();
  });
  $("b-liq").addEventListener("click", alternarLiquidaciones);
  $("b-fib").addEventListener("click", alternarFib);

  ["c-importe", "c-comision", "c-entrada", "c-inval", "c-objetivo"].forEach((id) => $(id).addEventListener("input", calcular));
  document.querySelectorAll("[data-importe]").forEach((b) => b.addEventListener("click", () => {
    $("c-importe").value = b.dataset.importe;
    calcular();
  }));
  $("c-usar-precio").addEventListener("click", () => {
    if (isFinite(mercado.eur)) {
      $("c-entrada").value = String(Math.round(mercado.eur));
      calcular();
    } else {
      avisoTemporal("Todavía no hay precio.", "atento");
    }
  });
  $("c-registrar").addEventListener("click", registrarDesdeCalculadora);

  $("f-nivel").addEventListener("submit", guardarNivel);
  $("n-limpiar").addEventListener("click", limpiarFormNivel);
  $("f-compra").addEventListener("submit", guardarCompra);
  $("f-nota").addEventListener("submit", guardarNota);
  $("k-fecha").value = hoyLocal();

  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.editarNivel) editarNivel(b.dataset.editarNivel);
    else if (b.dataset.borrarNivel) borrarNivel(b.dataset.borrarNivel);
    else if (b.dataset.borrarCompra) borrarCompra(b.dataset.borrarCompra);
    else if (b.dataset.borrarNota) borrarNota(b.dataset.borrarNota);
    else if (b.dataset.borrarEvento) borrarEvento(b.dataset.borrarEvento);
  });

  $("b-exportar").addEventListener("click", exportar);
  $("b-importar").addEventListener("click", () => $("b-archivo").click());
  $("b-archivo").addEventListener("change", importar);
  $("b-restaurar").addEventListener("click", restaurarSistema);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      actualizarPrecios();
      actualizarMiedo();
      calcularLiquidaciones();
      actualizarAnalisis();
      actualizarDerivados();
      leerVigilancia();
      leerCalendario();
      conectarDirecto();
      arrancarTemporizadores();
      if (chart && $("v-grafico").classList.contains("activa")) cargarVelas();
    } else {
      desconectarDirecto();
      pararTemporizadores();
    }
  });

  pintarNiveles();
  pintarCompras();
  pintarNotas();
  pintarPanel();
  pintarLiquidaciones();
  pintarCuentaAtras();
  setInterval(pintarCuentaAtras, 15000);

  let vistaInicial = "panel";
  try {
    vistaInicial = localStorage.getItem(CLAVE_VISTA) || "panel";
  } catch (e) {
    /* sin almacenamiento */
  }
  irA(vistaInicial);

  actualizarPrecios().then(() => {
    calcularLiquidaciones();
    actualizarAnalisis();
    actualizarDerivados();
  });
  leerVigilancia();
  leerCalendario();
  actualizarMiedo();
  conectarDirecto();
  arrancarTemporizadores();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* la app funciona igual sin modo sin conexión */
    });
  }
}

iniciar();

// Evita que el pellizco amplíe toda la página: el zoom solo actúa dentro del gráfico.
(function bloquearZoomPagina() {
  const noPagina = (e) => e.preventDefault();
  ["gesturestart", "gesturechange", "gestureend"].forEach((t) => document.addEventListener(t, noPagina, { passive: false }));
  document.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches.length > 1 && !(e.target.closest && e.target.closest("#grafico"))) e.preventDefault();
  }, { passive: false });
})();
