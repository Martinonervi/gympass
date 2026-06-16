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
 * Revisa el estado de la suscripción corporativa de un empleador.
 *
 * Si el plan estaba pagado pero la fecha de vencimiento ya pasó, lo da de baja
 * (planPagado: false) y deja una notificación para el empleador. La nómina de
 * empleados NO se toca (se conserva por si el empleador renueva).
 *
 * Devuelve { estado, vence } donde estado puede ser:
 *  - "vigente"      : pagado y dentro del período
 *  - "vencio-ahora" : acaba de vencer en esta revisión (se notificó)
 *  - "no-pagado"    : sin pago vigente
 *  - "sin-plan"     : el empleador no tiene doc / plan configurado
 */
export async function revisarVencimientoEmpleador(uid) {
  try {
    const ref = doc(db, "empleadores", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { estado: "sin-plan", vence: null };

    const data = snap.data();
    const vence = data.planVence?.toDate ? data.planVence.toDate() : null;
    const ahora = new Date();

    // Plan pagado y todavía vigente
    if (data.planPagado === true && vence && vence > ahora) {
      return { estado: "vigente", vence };
    }

    // Plan estaba pagado pero la fecha ya pasó → vencimiento recién detectado
    if (data.planPagado === true && vence && vence <= ahora) {
      await updateDoc(ref, { planPagado: false });
      await addDoc(collection(db, "usuarios", uid, "notificaciones"), {
        tipo: "plan_vencido",
        titulo: "Tu plan corporativo venció",
        mensaje:
          "Tu suscripción corporativa finalizó. Renovala para volver a cargar empleados y mantener los beneficios activos.",
        leida: false,
        creadoEn: serverTimestamp(),
      });
      return { estado: "vencio-ahora", vence };
    }

    return { estado: "no-pagado", vence };
  } catch (e) {
    console.log("revisarVencimientoEmpleador error:", e?.message);
    return { estado: "error", vence: null };
  }
}
