export function validateClase({ nombre, diaHora, duracion, profesor, cupo }) {
  if (!nombre || !nombre.trim()) return "El nombre de la clase es requerido.";
  if (!diaHora || !diaHora.trim()) return "El día y horario son requeridos.";
  if (cupo !== undefined && cupo !== null && cupo !== "") {
    const n = parseInt(cupo, 10);
    if (isNaN(n) || n <= 0) return "El cupo debe ser un número positivo.";
  }
  return null;
}

export function buildClase({ nombre, diaHora, duracion, profesor, cupo }) {
  return {
    nombre: nombre.trim(),
    diaHora: diaHora.trim(),
    duracion: duracion ? parseInt(duracion, 10) : null,
    profesor: profesor?.trim() || "",
    cupo: cupo ? parseInt(cupo, 10) : null,
  };
}

export function hasDisponibilidad(clase, reservasClase) {
  if (!clase.cupo) return true;
  return reservasClase.length < clase.cupo;
}

export function getLugaresRestantes(clase, reservasClase) {
  if (!clase.cupo) return null;
  return Math.max(0, clase.cupo - reservasClase.length);
}
