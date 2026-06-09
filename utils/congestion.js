import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Votes expire after 2 hours
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// Exponential decay: half-life of 90 minutes.
// A vote 90 min old carries 50% the weight of a fresh one.
// A vote 30 min old carries ~79% — recent votes matter more but
// a group of older votes can still outweigh one fresh vote.
const LAMBDA = Math.log(2) / 90;

/**
 * Returns a congestion level 0-3 for a given gym based on recent votes.
 * 0 = Tranquilo · 1 = Normal · 2 = Concurrido · 3 = Muy lleno
 *
 * Uses a time-weighted average with exponential decay so that:
 *  - Multiple votes beat a single outlier vote
 *  - More recent votes carry slightly more weight
 *  - Votes older than 2 hours are discarded
 */
export async function fetchGymCongestion(gymId) {
  try {
    const now = new Date();
    const cutoff = Timestamp.fromDate(new Date(now.getTime() - TWO_HOURS_MS));

    const snap = await getDocs(
      query(
        collection(db, "gimnasios", gymId, "congestion_votos"),
        where("creadoEn", ">=", cutoff)
      )
    );

    const votes = snap.docs.map((d) => d.data());
    if (votes.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    votes.forEach((v) => {
      const ageMinutes = (now - v.creadoEn.toDate()) / 60000;
      const w = Math.exp(-LAMBDA * ageMinutes);
      weightedSum += (v.valor ?? 0) * w;
      totalWeight += w;
    });

    const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return Math.round(Math.max(0, Math.min(3, avg)));
  } catch (e) {
    console.log("fetchGymCongestion error:", e?.message);
    return 0;
  }
}
