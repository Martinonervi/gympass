import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Votes expire after 2 hours
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// Exponential decay: half-life of 90 minutes.
// A vote 90 min old carries 50% the weight of a fresh one.
// A vote 30 min old carries ~79% — recent votes matter more but
// a group of older votes can still outweigh one fresh vote.
const LAMBDA = Math.log(2) / 90;

// Curva de afluencia según la hora del día (0..1). Pico fuerte 17-20h.
// Se usa solo para gimnasios demo (que tienen un nivel base `congestionDemo`).
function factorHorario(hora) {
  if (hora >= 17 && hora < 20) return 1.0;  // tarde pico
  if (hora >= 20 && hora < 21) return 0.7;
  if (hora >= 6 && hora < 9) return 0.6;    // mañana temprano
  if (hora >= 12 && hora < 14) return 0.5;  // mediodía
  if (hora >= 9 && hora < 12) return 0.35;
  if (hora >= 14 && hora < 17) return 0.35;
  if (hora >= 21 && hora < 23) return 0.3;
  return 0.1;                                // madrugada / cierre
}

// Nivel demo (0..3) a partir del nivel pico del gym y la hora actual.
function nivelDemo(base, fecha) {
  if (!base) return 0;
  const nivel = Math.round(base * factorHorario(fecha.getHours()));
  return Math.max(0, Math.min(3, nivel));
}

/**
 * Devuelve el nivel de congestión 0-3 de un gimnasio.
 * 0 = Tranquilo · 1 = Normal · 2 = Concurrido · 3 = Muy lleno
 *
 * Se basa en los votos reales de los últimos 120 minutos (promedio ponderado
 * con decaimiento exponencial). Para gimnasios demo —que traen un nivel pico
 * `congestionDemo`— se combina con una curva por horario, tomando el mayor de
 * ambos, así en horario pico se ven llenos sin depender de votos reales.
 *
 * @param {string} gymId
 * @param {number} [congestionDemo] nivel pico 0-3 (solo gimnasios demo)
 */
export async function fetchGymCongestion(gymId, congestionDemo = 0) {
  const demo = nivelDemo(congestionDemo, new Date());
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - TWO_HOURS_MS);

    const snap = await getDocs(
      query(
        collection(db, "gimnasios", gymId, "congestion_votos"),
        where("creadoEn", ">=", cutoff)
      )
    );

    const votes = snap.docs.map((d) => d.data());
    if (votes.length === 0) return demo;

    let weightedSum = 0;
    let totalWeight = 0;

    votes.forEach((v) => {
      const ageMinutes = (now - v.creadoEn.toDate()) / 60000;
      const w = Math.exp(-LAMBDA * ageMinutes);
      weightedSum += (v.valor ?? 0) * w;
      totalWeight += w;
    });

    const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const votos = Math.round(Math.max(0, Math.min(3, avg)));
    // Tomamos el mayor entre los votos reales y la curva demo.
    return Math.max(votos, demo);
  } catch (e) {
    console.log("fetchGymCongestion error:", e?.message);
    return demo;
  }
}
