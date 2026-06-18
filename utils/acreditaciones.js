import { doc, getDoc, updateDoc, collection, query, where, getDocs, increment } from "firebase/firestore";
import { db } from "../firebaseConfig";

const TARIFAS = { classic: 500, platinum: 800, black: 1200 };

/**
 * Acredita al gym el monto correspondiente por el pase validado.
 * Para usuarios Black, solo acredita si es la primera visita del día.
 * Debe llamarse ANTES de marcar la reserva como "usado".
 */
export async function acreditarPaseGym(reserva, gymId) {
  try {
    const userId = reserva.userId;
    if (!userId) return;

    const userSnap = await getDoc(doc(db, "usuarios", userId));
    if (!userSnap.exists()) return;

    const plan = (userSnap.data().plan || "").toLowerCase();
    const tarifa = TARIFAS[plan];
    if (!tarifa) return;

    if (plan === "black") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const snap = await getDocs(
        query(
          collection(db, "reservas"),
          where("gymId", "==", gymId),
          where("userId", "==", userId),
          where("estado", "==", "usado")
        )
      );

      const yaVisitóHoy = snap.docs.some((d) => {
        const validadoEn = d.data().validadoEn?.toDate?.();
        return validadoEn && validadoEn >= todayStart;
      });

      if (yaVisitóHoy) return;
    }

    await updateDoc(doc(db, "gimnasios", gymId), {
      saldoPendiente: increment(tarifa),
    });
  } catch (e) {
    console.log("acreditarPaseGym error:", e?.message);
  }
}
