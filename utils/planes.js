export const PLANES = {
  classic:  { nombre: "Classic",  descripcion: "Acceso a gimnasios básicos." },
  platinum: { nombre: "Platinum", descripcion: "Acceso a gimnasios premium y clases grupales." },
  black:    { nombre: "Black",    descripcion: "Acceso ilimitado a toda la red, incluyendo spa y nutrición." },
};

export const PLAN_IDS = Object.keys(PLANES);

export function isValidPlan(planId) {
  return PLAN_IDS.includes(planId);
}

export function getPlanData(planId) {
  return PLANES[planId] || null;
}

export function canAccessClases(planId) {
  return ["platinum", "black"].includes(planId);
}

export function canAccessGimnasiosBasicos(planId) {
  return isValidPlan(planId);
}
