// Tarifas legales — Decreto Distrital No. 0048 de 2026 (09-feb-2026)
// "Por medio del cual se fijan las tarifas del servicio público de transporte
// terrestre automotor de pasajeros en todas sus modalidades... Distrito
// Especial de Buenaventura." Secretaría de Tránsito y Transporte de Buenaventura.
//
// Usamos la tabla del Artículo Tercero (taxi por carreras / límite recorrido),
// que fija la "Carrera Mínima" — el piso legal para cualquier carrera de taxi
// en el distrito — como base de la tarifa mínima de Taxi y de Tura Favor.

// ── Artículo Tercero: Límite Recorrido – Taxi ──────────────────────────────
export const CARRERA_MINIMA = 6900; // trayectos < 2.5 km — tarifa vigente en Buenaventura
export const RECARGO_NOCTURNO_TAXI = 400; // 7:00 p.m. – 5:00 a.m.
export const RECARGO_DOMINICAL_FESTIVO_TAXI = 200; // domingos y festivos, 6:00 a.m. – 6:00 p.m.

// ── Artículo Quinto: tarifa por horas, zona urbana ─────────────────────────
export const TARIFA_HORA_TAXI = 23900;

// Grupos por zona de la misma tabla. OJO: estos valores quedaron desfasados
// cuando la Carrera Mínima subió a $6.900 — todos son menores que el piso, así
// que ya no pueden ser tarifas reales. No se usan en ningún cálculo (la tarifa
// sale de taxiEstimatedFare), quedan solo como referencia histórica hasta
// tener la tabla por zonas actualizada.
export const GRUPOS_TAXI_DESACTUALIZADOS = [
  { grupo: 'Grupo 1', hasta: 'Centro – Rockefeller', valor: 3400 },
  { grupo: 'Grupo 2', hasta: 'Centro – Bellavista', valor: 3500 },
  { grupo: 'Grupo 3', hasta: 'Centro – Transformación', valor: 3600 },
  { grupo: 'Grupo 4', hasta: 'Centro – La Independencia', valor: 4000 },
  { grupo: 'Grupo 5', hasta: 'Centro – Retén Km 11', valor: 4300 },
  { grupo: 'Grupo 6', hasta: 'Centro – Comuna 12 (Jesús Adolescente)', valor: 4500 },
];

// Tura Favor no tiene tarifa propia en el decreto (no es transporte de pasajeros),
// así que anclamos su piso al costo mínimo real de desplazamiento (Carrera Mínima)
// más el margen de servicio de Turapp por hacer el mandado.
export const TURA_FAVOR_MARGEN_SERVICIO = 5100;

// ── Festivos de Colombia (Ley 51 de 1983 / Ley Emiliani) ───────────────────
// Algoritmo de Meeus/Jones/Butcher para el Domingo de Pascua (calendario gregoriano)
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Ley Emiliani: si el festivo no cae en lunes, se traslada al lunes siguiente
function nextMonday(date) {
  const d = new Date(date);
  const dow = d.getUTCDay(); // 0 = domingo
  if (dow === 1) return d;
  const diff = (8 - dow) % 7 || 7;
  return addDays(d, dow === 0 ? 1 : diff);
}

const ymd = (d) => d.toISOString().slice(0, 10);

function colombianHolidays(year) {
  const easter = easterSunday(year);
  const fixed = [
    `${year}-01-01`, // Año Nuevo
    `${year}-05-01`, // Día del Trabajo
    `${year}-07-20`, // Independencia
    `${year}-08-07`, // Batalla de Boyacá
    `${year}-12-08`, // Inmaculada Concepción
    `${year}-12-25`, // Navidad
  ];
  const easterBased = [
    ymd(addDays(easter, -3)), // Jueves Santo
    ymd(addDays(easter, -2)), // Viernes Santo
  ];
  const emiliani = [
    new Date(Date.UTC(year, 0, 6)),   // Reyes Magos
    new Date(Date.UTC(year, 2, 19)),  // San José
    addDays(easter, 39),              // Ascensión del Señor
    addDays(easter, 60),              // Corpus Christi
    addDays(easter, 68),              // Sagrado Corazón
    new Date(Date.UTC(year, 5, 29)),  // San Pedro y San Pablo
    new Date(Date.UTC(year, 7, 15)),  // Asunción de la Virgen
    new Date(Date.UTC(year, 9, 12)),  // Día de la Raza
    new Date(Date.UTC(year, 10, 1)),  // Todos los Santos
    new Date(Date.UTC(year, 10, 11)), // Independencia de Cartagena
  ].map(d => ymd(nextMonday(d)));

  return new Set([...fixed, ...easterBased, ...emiliani]);
}

let holidayCache = null;
export function isColombianHoliday(date) {
  const year = date.getFullYear();
  if (!holidayCache || holidayCache.year !== year) {
    holidayCache = { year, set: colombianHolidays(year) };
  }
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return holidayCache.set.has(local);
}

export function isSunday(date) {
  return date.getDay() === 0;
}

export function isNightFare(date) {
  const h = date.getHours();
  return h >= 19 || h < 5; // 7:00 p.m. – 5:00 a.m.
}

// ── Tarifa mínima de Taxi, con recargos legales aplicados ──────────────────
export function taxiMinimumFare(when = new Date()) {
  let fare = CARRERA_MINIMA;
  if (isNightFare(when)) fare += RECARGO_NOCTURNO_TAXI;
  if (isSunday(when) || isColombianHoliday(when)) fare += RECARGO_DOMINICAL_FESTIVO_TAXI;
  return fare;
}

// Estimado por distancia: la Carrera Mínima cubre 2.5 km; más allá de eso
// interpolamos con la progresión de grupos de la misma tabla (~$700/km).
// No es una tarifa oficial por zona (eso requeriría geocodificación real),
// es un estimado conservador con piso legal.
const PER_KM_BEYOND_MINIMUM = 700;
export function taxiEstimatedFare(distanceKm = 0, when = new Date()) {
  const base = taxiMinimumFare(when);
  if (distanceKm <= 2.5) return base;
  return Math.round((base + (distanceKm - 2.5) * PER_KM_BEYOND_MINIMUM) / 100) * 100;
}

// ── Tura Favor: mínimo legal + margen de servicio ───────────────────────────
export function turaFavorServiceFee(when = new Date()) {
  return taxiMinimumFare(when) + TURA_FAVOR_MARGEN_SERVICIO;
}

export function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
