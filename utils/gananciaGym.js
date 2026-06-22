import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Cuota mensual que paga cada usuario según su plan.
const CUOTAS = { classic: 40000, platinum: 60000, black: 80000 };

// Porción de la cuota que, como máximo, se reparte entre los gimnasios.
// El resto (1 - este valor) queda para la app.
export const PORCENTAJE_GYMS = 0.85; // 85% gimnasios · 15% app

// Días de asistencia que equivalen a "ganar" el pool completo (85%) en el mes.
// 24 = ~6 días por semana (lun-sáb, horario típico de gimnasio) × 4 semanas.
// Por debajo de esto el gym cobra por día; por encima, se llega al techo.
const DIAS_PLENOS = 24;

/**
 * Calcula la ganancia estimada de un gimnasio en el mes en curso.
 *
 * Modelo: cada DÍA que un usuario valida su pase en un gym genera una fracción
 * de su cuota = (85% × cuota) / 24. El gym cobra por los días asistidos, con un
 * techo: el total que reciben TODOS los gimnasios por un usuario nunca supera el
 * 85% de su cuota (si asiste 24+ días, se reparte ese 85% en proporción).
 *
 * Consecuencias:
 *  - Una sola visita paga una sola visita (no el mes entero).
 *  - Validar varias veces el mismo gym el mismo día cuenta un solo día.
 *  - Más asistencia = más ganancia, hasta el tope del 85%.
 *  - Si el usuario asiste poco, la app retiene la parte no usada del pool.
 *
 * Se calcula al leer porque el reparto depende de la asistencia total del
 * usuario a todos los gimnasios durante el mes.
 */
export async function calcularGananciaGym(gymId) {
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // Todas las reservas validadas (usadas). Filtramos por fecha en cliente.
    const snap = await getDocs(
      query(collection(db, "reservas"), where("estado", "==", "usado"))
    );

    // Por usuario: plan + días distintos asistidos a cada gym.
    // userId -> { plan, gymDias: { gymId: Set(dias) } }
    const porUsuario = {};
    snap.forEach((d) => {
      const r = d.data();
      const validado = r.validadoEn?.toDate?.();
      if (!validado || validado < inicioMes) return;
      if (!r.userId || !r.gymId) return;

      const dia = `${validado.getFullYear()}-${validado.getMonth()}-${validado.getDate()}`;
      if (!porUsuario[r.userId]) {
        porUsuario[r.userId] = {
          plan: (r.planUsuario || "classic").toLowerCase(),
          gymDias: {},
        };
      }
      const gymDias = porUsuario[r.userId].gymDias;
      if (!gymDias[r.gymId]) gymDias[r.gymId] = new Set();
      gymDias[r.gymId].add(dia);
    });

    let total = 0;
    Object.values(porUsuario).forEach(({ plan, gymDias }) => {
      const cuota = CUOTAS[plan];
      if (!cuota) return;

      const diasEsteGym = gymDias[gymId]?.size || 0;
      if (diasEsteGym === 0) return;

      let diasTotales = 0;
      Object.values(gymDias).forEach((set) => (diasTotales += set.size));

      const pool = PORCENTAJE_GYMS * cuota;

      if (diasTotales <= DIAS_PLENOS) {
        // Asistencia normal: se cobra por día; la app retiene el pool no usado.
        total += diasEsteGym * (pool / DIAS_PLENOS);
      } else {
        // Asistencia alta: se llegó al techo; se reparte el 85% por proporción.
        total += pool * (diasEsteGym / diasTotales);
      }
    });

    return Math.round(total);
  } catch (e) {
    console.log("calcularGananciaGym error:", e?.message);
    return 0;
  }
}
