import { isValidPlan, getPlanData, canAccessClases, canAccessGimnasiosBasicos, PLAN_IDS } from "../utils/planes";

describe("Planes — validación", () => {
  it("acepta los planes existentes", () => {
    expect(isValidPlan("classic")).toBe(true);
    expect(isValidPlan("platinum")).toBe(true);
    expect(isValidPlan("black")).toBe(true);
  });

  it("rechaza planes inexistentes", () => {
    expect(isValidPlan("gold")).toBe(false);
    expect(isValidPlan("")).toBe(false);
    expect(isValidPlan(null)).toBe(false);
  });

  it("hay exactamente 3 planes disponibles", () => {
    expect(PLAN_IDS).toHaveLength(3);
  });
});

describe("Planes — datos", () => {
  it("retorna datos del plan si existe", () => {
    const plan = getPlanData("classic");
    expect(plan).not.toBeNull();
    expect(plan.nombre).toBe("Classic");
    expect(plan.descripcion).toBeTruthy();
  });

  it("retorna null si el plan no existe", () => {
    expect(getPlanData("inexistente")).toBeNull();
    expect(getPlanData(null)).toBeNull();
  });

  it("cada plan tiene nombre y descripción", () => {
    PLAN_IDS.forEach((id) => {
      const plan = getPlanData(id);
      expect(plan.nombre).toBeTruthy();
      expect(plan.descripcion).toBeTruthy();
    });
  });
});

describe("Planes — acceso a clases grupales", () => {
  it("classic no incluye clases grupales", () => {
    expect(canAccessClases("classic")).toBe(false);
  });

  it("platinum incluye clases grupales", () => {
    expect(canAccessClases("platinum")).toBe(true);
  });

  it("black incluye clases grupales", () => {
    expect(canAccessClases("black")).toBe(true);
  });
});

describe("Planes — acceso a gimnasios básicos", () => {
  it("cualquier plan válido tiene acceso a gimnasios básicos", () => {
    expect(canAccessGimnasiosBasicos("classic")).toBe(true);
    expect(canAccessGimnasiosBasicos("platinum")).toBe(true);
    expect(canAccessGimnasiosBasicos("black")).toBe(true);
  });

  it("sin plan no hay acceso", () => {
    expect(canAccessGimnasiosBasicos(null)).toBe(false);
    expect(canAccessGimnasiosBasicos("")).toBe(false);
  });
});
