// Vigilancia BTC · se ejecuta en GitHub Actions cada 30 minutos.
// Usa las mismas reglas que el widget de Scriptable (modelo v2) con las velas de Kraken BTCEUR,
// manda avisos al móvil con ntfy y guarda un registro diario con el resultado a 30 y 90 días.
// Es una ayuda: la decisión de compra la toma el usuario con la app.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_CONFIG = path.join(DIR, "config.json");
const F_ESTADO = path.join(DIR, "estado.json");
const F_REGISTRO = path.join(DIR, "registro.csv");
const DIA = 86400;
const SEMANA = 604800;

const CONFIG = JSON.parse(fs.readFileSync(F_CONFIG, "utf8"));
const F_CALENDARIO = path.join(DIR, "calendario.json");
const CALENDARIO = fs.existsSync(F_CALENDARIO) ? (JSON.parse(fs.readFileSync(F_CALENDARIO, "utf8")).eventos || []) : [];
const primeraVez = !fs.existsSync(F_ESTADO);
const estado = primeraVez
  ? { ultimoCierre: 0, avisos: {}, rotas: {}, pausa: null }
  : JSON.parse(fs.readFileSync(F_ESTADO, "utf8"));
estado.avisos = estado.avisos || {};
estado.rotas = estado.rotas || {};
estado.rearmadas = estado.rearmadas || {};
estado.pausa = estado.pausa || null;

const TOPIC = process.env.NTFY_TOPIC || "";
const PRUEBA = process.env.PRUEBA === "1";
const SIN_ENVIO = process.env.SIN_ENVIO === "1" || !TOPIC;
const AHORA = process.env.AHORA ? Number(process.env.AHORA) : Math.floor(Date.now() / 1000);

const nf = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const eur = (n) => nf.format(Math.round(n)) + " €";
const dia = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const fechaCorta = (t) => new Date(t * 1000).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const horaEsp = (t) => new Date(t * 1000).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

let cambios = false;

// La app manda una copia de zonas, eventos y niveles por el tema de control de ntfy; si existe, manda sobre config.json.
const SYNC = () => estado.sincronizado || null;
const ZONAS = () => (SYNC() && Array.isArray(SYNC().zonas) ? SYNC().zonas : CONFIG.zonas);
const EVENTOS_MANUALES = () => (SYNC() && Array.isArray(SYNC().eventos) ? SYNC().eventos : CONFIG.eventos || []);
// Calendario automático + datos apuntados a mano (si coinciden fecha y hora, manda el automático).
const EVENTOS = () => {
  const vistos = new Set(CALENDARIO.map((e) => e.fecha + " " + (e.hora || "00:00")));
  return CALENDARIO.concat(EVENTOS_MANUALES().filter((e) => !vistos.has(e.fecha + " " + (e.hora || "00:00"))));
};
// Hora de España (CET/CEST) a segundos UTC.
function tsEspana(fecha, hora) {
  const guess = Date.parse(fecha + "T" + (hora || "00:00") + ":00Z");
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(new Date(guess));
  const off = ((Number(partes) - new Date(guess).getUTCHours()) + 24) % 24;
  return guess / 1000 - off * 3600;
}
const PAUSA = () => (SYNC() && isFinite(SYNC().pausa) ? SYNC().pausa : CONFIG.pausa);
const RESISTENCIA = () => (SYNC() && SYNC().resistencia ? SYNC().resistencia : CONFIG.resistencia);

async function leerControl() {
  if (!TOPIC || SIN_ENVIO) return;
  const r = await fetch("https://ntfy.sh/" + encodeURIComponent(TOPIC + "-control") + "/json?poll=1&since=12h");
  if (!r.ok) throw new Error("ntfy control " + r.status);
  const lineas = (await r.text()).split("\n").filter(Boolean);
  let ultimo = null;
  for (const l of lineas) {
    let m;
    try {
      m = JSON.parse(l);
    } catch (e) {
      continue;
    }
    if (m.event !== "message") continue;
    let d;
    try {
      d = JSON.parse(m.message);
    } catch (e) {
      continue;
    }
    if (d && d.tipo === "sync" && Number(d.ts) > 0 && (!ultimo || d.ts > ultimo.ts)) ultimo = d;
  }
  if (ultimo) aplicarSync(ultimo);
}

function aplicarSync(d) {
  const previo = SYNC();
  if (previo && previo.ts >= d.ts) return;
  estado.sincronizado = {
    ts: d.ts,
    zonas: (d.zonas || []).map((z) => ({ id: String(z.id), min: Number(z.min), max: Number(z.max), estado: z.estado, rearme: z.rearme || undefined })),
    eventos: d.eventos || [],
    pausa: Number(d.pausa),
    resistencia: d.resistencia || null,
    reanudar: Number(d.reanudar) || 0
  };
  // zona reactivada a mano en la app después de romperse
  for (const z of estado.sincronizado.zonas) {
    const rota = estado.rotas[z.id];
    if (rota && z.estado !== "rota" && d.ts > Date.parse(rota + "T00:00:00Z") + DIA * 1000) delete estado.rotas[z.id];
  }
  if (estado.pausa && estado.sincronizado.reanudar > estado.pausa.t * 1000) {
    estado.pausa = null;
    estado.reanudada = AHORA;
  }
  cambios = true;
}

// ---------- avisos ----------
async function avisar(clave, titulo, mensaje, prioridad = 3, etiquetas = []) {
  if (clave && estado.avisos[clave]) return;
  if (SIN_ENVIO) {
    console.log("[AVISO]", titulo, "·", mensaje);
  } else {
    const r = await fetch("https://ntfy.sh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: TOPIC, title: titulo, message: mensaje, priority: prioridad, tags: etiquetas, click: CONFIG.app })
    });
    if (!r.ok) throw new Error("ntfy respondió " + r.status);
  }
  if (clave) {
    estado.avisos[clave] = AHORA;
    cambios = true;
  }
}

// ---------- datos ----------
async function velasKraken(intervalo) {
  const r = await fetch("https://api.kraken.com/0/public/OHLC?pair=XBTEUR&interval=" + intervalo);
  const j = await r.json();
  if (j.error && j.error.length) throw new Error("Kraken: " + j.error.join(", "));
  const clave = Object.keys(j.result).find((k) => k !== "last");
  return j.result[clave].map((x) => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[6] }));
}

async function miedoActual() {
  try {
    const r = await fetch("https://api.alternative.me/fng/?limit=1");
    const j = await r.json();
    return Number(j.data[0].value);
  } catch (e) {
    return NaN;
  }
}

// ---------- indicadores (iguales que el widget) ----------
function rsi(c, n = 14) {
  if (c.length < n + 1) return NaN;
  let g = 0;
  let p = 0;
  for (let i = 1; i <= n; i++) {
    const d = c[i] - c[i - 1];
    if (d > 0) g += d;
    else p -= d;
  }
  let mg = g / n;
  let mp = p / n;
  for (let i = n + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    mg = (mg * (n - 1) + Math.max(d, 0)) / n;
    mp = (mp * (n - 1) + Math.max(-d, 0)) / n;
  }
  return mp === 0 ? 100 : 100 - 100 / (1 + mg / mp);
}

const media = (a, n) => (a.length >= n ? a.slice(-n).reduce((s, x) => s + x, 0) / n : NaN);

// ---- Indicadores en observación (no deciden): CM Williams Vix Fix y WaveTrend (LazyBear) ----
function emaSerie(v, n) {
  const k = 2 / (n + 1);
  const out = [];
  let e = NaN;
  for (const x of v) {
    e = isFinite(e) ? x * k + e * (1 - k) : x;
    out.push(e);
  }
  return out;
}

function vixFix(hs, ls, cs) {
  const wvf = [];
  for (let i = 0; i < cs.length; i++) {
    if (i < 21) { wvf.push(NaN); continue; }
    let hc = 0;
    for (let j = i - 21; j <= i; j++) if (cs[j] > hc) hc = cs[j];
    wvf.push(((hc - ls[i]) / hc) * 100);
  }
  const n = wvf.length - 1;
  if (n < 75) return { valor: NaN, alerta: false };
  const u20 = wvf.slice(n - 19, n + 1);
  const m = u20.reduce((s, x) => s + x, 0) / 20;
  const sd = Math.sqrt(u20.reduce((s, x) => s + (x - m) * (x - m), 0) / 19);
  const max50 = Math.max.apply(null, wvf.slice(n - 49, n + 1));
  return { valor: wvf[n], alerta: wvf[n] >= m + 2 * sd || wvf[n] >= max50 * 0.85 };
}

function waveTrend(hs, ls, cs) {
  if (cs.length < 60) return NaN;
  const ap = cs.map((c, i) => (hs[i] + ls[i] + c) / 3);
  const esa = emaSerie(ap, 10);
  const d = emaSerie(ap.map((x, i) => Math.abs(x - esa[i])), 10);
  const ci = ap.map((x, i) => (d[i] > 0 ? (x - esa[i]) / (0.015 * d[i]) : 0));
  const wt1 = emaSerie(ci, 21);
  return wt1[wt1.length - 1];
}

function indicadoresEn(dias, i, semanas) {
  const d = dias.slice(0, i + 1);
  const x = d[d.length - 1];
  const c = d.map((y) => y.c);
  const m20 = media(c, 20);
  const sd = Math.sqrt(c.slice(-20).reduce((s, y) => s + (y - m20) * (y - m20), 0) / 20);
  let atr = 0;
  for (let k = 1; k < d.length; k++) {
    const tr = Math.max(d[k].h - d[k].l, Math.abs(d[k].h - d[k - 1].c), Math.abs(d[k].l - d[k - 1].c));
    if (k <= 14) {
      atr += tr;
      if (k === 14) atr /= 14;
    } else {
      atr = (atr * 13 + tr) / 14;
    }
  }
  let sP = 0;
  let sN = 0;
  let sT = 0;
  let adx = NaN;
  let sumaDx = 0;
  for (let k = 1; k < d.length; k++) {
    const sube = d[k].h - d[k - 1].h;
    const baja = d[k - 1].l - d[k].l;
    const p = sube > baja && sube > 0 ? sube : 0;
    const n = baja > sube && baja > 0 ? baja : 0;
    const tr = Math.max(d[k].h - d[k].l, Math.abs(d[k].h - d[k - 1].c), Math.abs(d[k].l - d[k - 1].c));
    if (k <= 14) {
      sP += p;
      sN += n;
      sT += tr;
    } else {
      sP = sP - sP / 14 + p;
      sN = sN - sN / 14 + n;
      sT = sT - sT / 14 + tr;
    }
    if (k >= 14 && sT > 0) {
      const dp = (100 * sP) / sT;
      const dn = (100 * sN) / sT;
      const dx = dp + dn > 0 ? (100 * Math.abs(dp - dn)) / (dp + dn) : 0;
      if (k < 28) {
        sumaDx += dx;
        if (k === 27) adx = sumaDx / 14;
      } else {
        adx = (adx * 13 + dx) / 14;
      }
    }
  }
  const cerradas = semanas.filter((w) => w.t + SEMANA <= x.t + DIA);
  const cw = cerradas.map((w) => w.c);
  return {
    x: x,
    previa: d[d.length - 2],
    rsi: rsi(c),
    banda: m20 - 2 * sd,
    volRel: x.v / media(d.map((y) => y.v), 20),
    atr: atr,
    adx: adx,
    vix: vixFix(d.map((y) => y.h), d.map((y) => y.l), c),
    wt: waveTrend(d.map((y) => y.h), d.map((y) => y.l), c),
    sma200: media(c, 200),
    ma20w: media(cw, 20),
    ma200w: media(cw, 200),
    cierreSemana: cerradas.length ? cerradas[cerradas.length - 1].c : NaN
  };
}

const claveCompra = (z) => (z.rearme ? z.id + "-" + z.rearme.desde : "");

function zonasVigentes(t) {
  const momento = t === undefined ? AHORA : t;
  return ZONAS().map((z) => {
    let e = z.estado;
    // una compra solo cuenta para las velas desde su fecha (las anteriores se evalúan como antes de comprar)
    if (e === "comprada" && z.rearme && momento < Date.parse(z.rearme.desde + "T00:00:00Z") / 1000) e = "activa";
    if (e === "comprada" && z.rearme && estado.rearmadas[claveCompra(z)]) e = "activa";
    if (estado.rotas[z.id] && e !== "comprada") e = "rota";
    return Object.assign({}, z, { estado: e });
  });
}

function evaluar(ind) {
  const x = ind.x;
  const margen = 0.5 * ind.atr;
  const rango = x.h - x.l;
  const pos = rango > 0 ? (x.c - x.l) / rango : 0;
  const cuerpo = Math.abs(x.o - x.c);
  const mecha = Math.min(x.o, x.c) - x.l;
  const candidatas = zonasVigentes(x.t)
    .filter((z) => z.estado !== "rota" && x.l <= z.max + margen && x.c >= z.min - margen)
    .sort((a, b) => a.max - b.max);
  let zona = candidatas.find((z) => z.estado !== "comprada") || candidatas[0] || null;
  const rota = zona && zona.estado !== "comprada" && x.c < zona.min ? zona : null;
  if (rota) zona = null;
  const comprada = !!zona && zona.estado === "comprada";
  const banda = x.l < ind.banda && x.c > ind.banda;
  const mechaOk = (mecha / x.c) * 100 >= 1 && mecha >= cuerpo;
  const rechazo = (banda || mechaOk) && pos >= 0.5 && (!zona || x.c >= zona.min);
  const confirmacion = ind.rsi < 45 || ind.volRel >= 1.3;
  const cerca200 = isFinite(ind.ma200w) && x.l <= ind.ma200w * 1.03;
  const capitulacion = ind.rsi < 35 && ind.volRel >= 1.5;
  const bajista = (isFinite(ind.sma200) && x.c < ind.sma200) || (isFinite(ind.ma20w) && ind.cierreSemana < ind.ma20w);
  let mult = 1;
  if (cerca200) mult = 2;
  else {
    if (capitulacion) mult = 2;
    if (bajista) mult *= 0.5;
  }
  const senal = !!zona && rechazo && confirmacion;
  const cautela = senal && mult < 1;
  const compra = senal && !comprada && !cautela;
  return {
    zona, rota, comprada, margen, pos, banda, mechaOk, rechazo, confirmacion, cerca200, capitulacion, bajista, mult,
    senal, cautela, compra, fuerte: compra && mult >= 2, importeWidget: compra ? (mult >= 2 ? 40 : 20) : 0
  };
}

function eventoCerca(desde, horas) {
  for (const e of EVENTOS()) {
    const ts = tsEspana(e.fecha, e.hora);
    if (ts - desde > -3600 && ts - desde <= horas * 3600) return Object.assign({ ts }, e);
  }
  return null;
}

function importeRegla(ind, s, miedo, momento) {
  if (!s.compra) return 0;
  const base = s.cerca200 && s.capitulacion ? 50 : s.mult >= 2 ? 40 : 20;
  const dist = ind.x.c > s.zona.min ? (ind.x.c - s.zona.min) / ind.x.c : 0;
  let imp = Math.min(base, dist > 0 ? 2.5 / dist : base);
  if (eventoCerca(momento, 24)) imp /= 2;
  if (miedo > 75) imp /= 2;
  imp = Math.floor(imp / 5) * 5;
  return imp >= 20 ? imp : 0;
}

function resumen(ind, s) {
  return "RSI " + nf1.format(ind.rsi) + " · volumen " + ind.volRel.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + "× · " +
    (s.cerca200 ? "en la media de 200 semanas" : s.capitulacion ? "capitulación" : "tendencia " + (s.bajista ? "bajista" : "normal"));
}

// ---------- registro ----------
const CABECERA = "fecha,cierre,minimo,zona,resultado,importe_widget,importe_regla,rsi,vol_rel,cerca200,capitulacion,bajista,cierre_30d,rent_30d,cierre_90d,rent_90d,adx,vixfix,wt1";

function leerRegistro() {
  if (!fs.existsSync(F_REGISTRO)) return [];
  return fs.readFileSync(F_REGISTRO, "utf8").trim().split("\n").slice(1).filter(Boolean).map((l) => l.split(","));
}

function textoResultado(s) {
  if (s.pausada) return "pausa";
  if (s.compra) return s.fuerte ? "fuerte" : "normal";
  if (s.cautela) return "cautela";
  if (s.senal && s.comprada) return "zona_comprada";
  return "ninguna";
}

// ---------- principal ----------
async function main() {
  try {
    await leerControl();
  } catch (e) {
    console.error("No se pudo leer el tema de control:", e.message);
  }
  if (estado.reanudada && !estado.avisos["reanudada-" + estado.reanudada]) {
    await avisar("reanudada-" + estado.reanudada, "Compras reanudadas", "Has reanudado el sistema desde la app. Vuelven a valer las señales.", 3, ["arrow_forward"]);
  }
  const [dias, semanas, miedo] = await Promise.all([velasKraken(1440), velasKraken(10080), miedoActual()]);
  let iCerrada = dias.length - 1;
  while (iCerrada >= 0 && dias[iCerrada].t + DIA > AHORA) iCerrada--;
  const viva = dias[dias.length - 1];
  const hayViva = viva.t + DIA > AHORA;

  if (primeraVez) {
    estado.ultimoCierre = dias[iCerrada - 1].t;
    await avisar(null, "Vigilancia BTC activada", "Recibirás avisos de zonas, señales provisionales y del cierre diario (1:00). Precio: " + eur(viva.c) + ".", 3, ["white_check_mark"]);
    cambios = true;
  }
  if (PRUEBA) {
    await avisar(null, "Prueba de Vigilancia BTC", "Los avisos funcionan. Precio actual: " + eur(viva.c) + " (Kraken).", 3, ["bell"]);
  }

  // 1) velas cerradas nuevas
  const registro = leerRegistro();
  for (let i = 0; i <= iCerrada; i++) {
    const x = dias[i];
    if (x.t <= estado.ultimoCierre) continue;
    const ind = indicadoresEn(dias, i, semanas);
    const s = evaluar(ind);
    const regla = importeRegla(ind, s, miedo, x.t + DIA);
    const fecha = fechaCorta(x.t);

    // rearme: zona comprada que cierra un 5 % por debajo del precio pagado y sigue dentro de la zona
    for (const z of zonasVigentes(x.t)) {
      if (z.estado !== "comprada" || !z.rearme) continue;
      const desde = Date.parse(z.rearme.desde + "T00:00:00Z") / 1000;
      if (x.t >= desde && x.c < z.rearme.umbral && x.c >= z.min * 0.985 && !estado.rearmadas[claveCompra(z)]) {
        estado.rearmadas[claveCompra(z)] = dia(x.t);
        delete estado.rotas[z.id];
        await avisar("rearme-" + claveCompra(z), z.id + " vuelve a estar disponible",
          "La vela del " + fecha + " cerró en " + eur(x.c) + ", por debajo del nivel de rearme (" + eur(z.rearme.umbral) + ") y dentro de la zona. Si hay señal, podrás volver a comprar en " + z.id + ".", 4, ["recycle"]);
      }
    }

    if (s.rota && !estado.rotas[s.rota.id]) {
      estado.rotas[s.rota.id] = dia(x.t);
      await avisar("rota-" + s.rota.id + "-" + dia(x.t), s.rota.id + " rota", "La vela del " + fecha + " cerró en " + eur(x.c) + ", por debajo de " + eur(s.rota.min) + ". Queda marcada como rota en la app.", 4, ["warning"]);
    }
    for (const z of zonasVigentes(x.t)) {
      if (z.estado === "activa" && x.c < z.min && !estado.rotas[z.id]) {
        estado.rotas[z.id] = dia(x.t);
        await avisar("rota-" + z.id + "-" + dia(x.t), z.id + " rota", "La vela del " + fecha + " cerró en " + eur(x.c) + ", por debajo de " + eur(z.min) + ".", 4, ["warning"]);
      }
    }
    if (PAUSA() && ind.previa && x.c < PAUSA() && ind.previa.c >= PAUSA() && !estado.pausa) {
      estado.pausa = { fecha: dia(x.t), t: x.t, cierre: Math.round(x.c) };
      await avisar("pausa-" + dia(x.t), "Compras en pausa", "Cierre del " + fecha + " en " + eur(x.c) + ", por debajo de " + eur(PAUSA()) + ". No habrá señales de compra hasta que lo revises y toques «Reanudar» en la app.", 5, ["rotating_light"]);
    }
    if (estado.pausa && s.compra) {
      s.compra = false;
      s.pausada = true;
    }
    const resis = RESISTENCIA();
    if (resis && x.c > resis.max) {
      await avisar("resistencia-" + dia(x.t), "Por encima de la resistencia", "Cierre del " + fecha + " en " + eur(x.c) + ", por encima de " + eur(resis.max) + ". Si se mantiene unos días, revisa tus zonas.", 3, ["chart_with_upwards_trend"]);
    }

    if (s.compra) {
      await avisar("cierre-" + dia(x.t), "Señal " + (s.fuerte ? "FUERTE" : "normal") + " en " + s.zona.id + " · cierre " + fecha,
        "Cierre " + eur(x.c) + " · " + resumen(ind, s) + ". Importe: widget " + s.importeWidget + " € · regla nueva " + (regla ? regla + " €" : "no compra") + ". Revísalo en la app (Análisis → Última vela cerrada).", 5, ["moneybag"]);
    } else if (s.pausada) {
      await avisar("cierre-" + dia(x.t), "Señal en pausa · " + s.zona.id, "Habría señal en " + s.zona.id + " (cierre " + eur(x.c) + "), pero las compras están en pausa desde el " + estado.pausa.fecha + ". Revísalo y toca «Reanudar» en la app si procede.", 4, ["pause_button"]);
    } else if (estado.avisos["prov-" + dia(x.t)]) {
      const motivo = s.cautela ? "queda con cautela (no se compra)" : s.senal && s.comprada ? s.zona.id + " ya está comprada" : "no se ha confirmado";
      await avisar("cierre-" + dia(x.t), "Cierre " + fecha + ": sin compra", "La señal provisional " + motivo + ". Cierre " + eur(x.c) + ".", 3, ["information_source"]);
    }

    const fila = [dia(x.t), Math.round(x.c), Math.round(x.l), s.zona ? s.zona.id : "", textoResultado(s), s.importeWidget, regla,
      ind.rsi.toFixed(1), ind.volRel.toFixed(2), s.cerca200 ? 1 : 0, s.capitulacion ? 1 : 0, s.bajista ? 1 : 0, "", "", "", "", isFinite(ind.adx) ? ind.adx.toFixed(1) : "",
      ind.vix && isFinite(ind.vix.valor) ? (ind.vix.alerta ? 1 : 0) : "", isFinite(ind.wt) ? ind.wt.toFixed(1) : ""];
    const k = registro.findIndex((r) => r[0] === fila[0]);
    if (k >= 0) registro[k] = fila;
    else registro.push(fila);
    estado.ultimoCierre = x.t;
    cambios = true;
  }

  // 2) resultados a 30 y 90 días
  const porFecha = new Map(dias.map((y) => [dia(y.t), y]));
  for (const r of registro) {
    const t0 = Date.parse(r[0] + "T00:00:00Z") / 1000;
    for (const [n, col] of [[30, 12], [90, 14]]) {
      if (r[col]) continue;
      const y = porFecha.get(dia(t0 + n * DIA));
      if (y && y.t + DIA <= AHORA) {
        r[col] = Math.round(y.c);
        r[col + 1] = ((y.c / Number(r[1]) - 1) * 100).toFixed(1);
        cambios = true;
      }
    }
  }
  for (const r of registro) while (r.length < 17) r.push("");
  registro.sort((a, b) => a[0].localeCompare(b[0]));
  const textoRegistro = [CABECERA].concat(registro.map((r) => r.join(","))).join("\n") + "\n";

  // 3) vela en curso
  if (hayViva) {
    const hoy = dia(viva.t);
    for (const z of zonasVigentes()) {
      if (z.estado === "activa" && viva.c <= z.max && viva.c >= z.min) {
        await avisar("entra-" + z.id + "-" + hoy, "BTC entra en " + z.id, "Precio " + eur(viva.c) + " (" + eur(z.min) + "–" + eur(z.max) + "). " + (estado.pausa ? "Las compras siguen en pausa: revisa el sistema antes de reanudar." : "No compres todavía: espera al cierre de la 1:00."), 4, ["round_pushpin"]);
      }
    }
    const ind = indicadoresEn(dias, dias.length - 1, semanas);
    const s = evaluar(ind);
    if (estado.pausa) s.compra = false;
    const quedan = viva.t + DIA - AHORA;
    const quedanTxt = Math.floor(quedan / 3600) + " h " + String(Math.floor((quedan % 3600) / 60)).padStart(2, "0") + " min";
    if (s.compra) {
      const regla = importeRegla(ind, s, miedo, viva.t + DIA);
      await avisar("prov-" + hoy, "Señal provisional " + (s.fuerte ? "FUERTE" : "normal") + " en " + s.zona.id,
        "Precio " + eur(viva.c) + " · " + resumen(ind, s) + ". Cierre en " + quedanTxt + ". Importe: widget " + s.importeWidget + " € · regla nueva " + (regla ? regla + " €" : "no compra") + ". Todavía no compres.", 4, ["hourglass"]);
      if (quedan <= 5400) {
        await avisar("precierre-" + hoy, "Cierre en " + quedanTxt + ": la señal sigue", "Precio " + eur(viva.c) + ". Si se mantiene, a la 1:00 habrá señal " + (s.fuerte ? "FUERTE" : "normal") + " en " + s.zona.id + ".", 4, ["alarm_clock"]);
      }
    }
  }

  // 4) datos macro en las próximas 24 h
  const ev = eventoCerca(AHORA, 24);
  if (ev) {
    await avisar("evento-" + ev.fecha + "-" + ev.nombre, "Dato macro: " + ev.nombre, "Se publica el " + ev.fecha + " a las " + ev.hora + " (hora de España). Evita decidir en la hora del dato.", 3, ["calendar"]);
  }

  // limpiar avisos de hace más de 120 días
  for (const [k, t] of Object.entries(estado.avisos)) if (AHORA - t > 120 * DIA) delete estado.avisos[k];

  if (cambios) {
    fs.writeFileSync(F_ESTADO, JSON.stringify(estado, null, 1) + "\n");
    fs.writeFileSync(F_REGISTRO, textoRegistro);
  }
  console.log("Precio " + eur(viva.c) + " · última vela cerrada " + dia(dias[iCerrada].t) + " · cambios: " + (cambios ? "sí" : "no") + " · " + horaEsp(AHORA));
}

main().catch(async (e) => {
  console.error(e);
  try {
    await avisar("error-" + dia(AHORA), "Vigilancia BTC: error", "No se pudo revisar el mercado: " + String(e.message || e).slice(0, 140) + ". Se reintentará en 30 minutos.", 2, ["x"]);
    if (cambios) fs.writeFileSync(F_ESTADO, JSON.stringify(estado, null, 1) + "\n");
  } catch (e2) {
    console.error(e2);
  }
  process.exit(1);
});
