export function buildReservaPase({ userId, gymId, nombreGimnasio }) {
  return {
    userId,
    tipo: "pase",
    gymId,
    nombreGimnasio: nombreGimnasio || "",
    estado: "pendiente",
  };
}

export function buildReservaClase({ userId, gymId, nombreGimnasio, clase }) {
  return {
    userId,
    tipo: "clase",
    gymId,
    nombreGimnasio: nombreGimnasio || "",
    claseId: clase.id,
    nombreClase: clase.nombre,
    diaHora: clase.diaHora || "",
    estado: "pendiente",
  };
}

export function isDuplicatePase(reservas, userId, gymId) {
  return reservas.some(
    (r) => r.userId === userId && r.gymId === gymId && r.tipo === "pase"
  );
}

export function isDuplicateClase(reservas, userId, gymId, claseId) {
  return reservas.some(
    (r) =>
      r.userId === userId &&
      r.gymId === gymId &&
      r.tipo === "clase" &&
      r.claseId === claseId
  );
}

export function sortReservasByDate(reservas) {
  return [...reservas].sort(
    (a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)
  );
}

export function formatReservaDate(timestamp) {
  if (!timestamp?.seconds) return "";
  return new Date(timestamp.seconds * 1000).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function filterReservasByUser(reservas, userId) {
  return reservas.filter((r) => r.userId === userId);
}

export function filterReservasByGym(reservas, gymId) {
  return reservas.filter((r) => r.gymId === gymId);
}
