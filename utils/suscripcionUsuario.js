import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * Revisa si el plan mensual de un usuario común venció.
 *
 * Si tenía un plan activo y la fecha de vencimiento ya pasó, lo da de baja
 * (plan: null) y deja una notificación. Devuelve true si recién venció en esta
 * revisión (para reflejarlo en la UI al instante).
 *
 * Es idempotente: una vez dado de baja, las siguientes llamadas no hacen nada.
 */
export async function revisarVencimientoUsuario(uid) {
  try {
    const ref = doc(db, "usuarios", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;

    const data = snap.data();
    if (!data.plan) return false; // sin plan activo, nada que vencer

    const vence = data.planVence?.toDate ? data.planVence.toDate() : null;
    if (!vence || vence > new Date()) return false; // todavía vigente

    // Venció: damos de baja y notificamos.
    await updateDoc(ref, { plan: null, planVence: null });
    await addDoc(collection(db, "usuarios", uid, "notificaciones"), {
      tipo: "plan_vencido",
      titulo: "Tu plan venció",
      mensaje:
        "Tu plan mensual finalizó. Renovalo desde Mi Pase para seguir accediendo a los gimnasios.",
      leida: false,
      creadoEn: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.log("revisarVencimientoUsuario error:", e?.message);
    return false;
  }
}
