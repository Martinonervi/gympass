import { validateClase, buildClase, hasDisponibilidad, getLugaresRestantes } from "../utils/clases";

describe("Clases del gimnasio — validaciones", () => {
  const base = { nombre: "Crossfit", diaHora: "Lunes 18:00", duracion: "60", profesor: "Juan", cupo: "20" };

  it("pasa con todos los campos válidos", () => {
    expect(validateClase(base)).toBeNull();
  });

  it("pasa sin campos opcionales (duracion, profesor, cupo)", () => {
    expect(validateClase({ nombre: "Yoga", diaHora: "Martes 10:00" })).toBeNull();
  });

  it("falla si falta el nombre", () => {
    expect(validateClase({ ...base, nombre: "" })).toBeTruthy();
    expect(validateClase({ ...base, nombre: "   " })).toBeTruthy();
  });

  it("falla si falta el día y horario", () => {
    expect(validateClase({ ...base, diaHora: "" })).toBeTruthy();
  });

  it("falla si el cupo no es un número positivo", () => {
    expect(validateClase({ ...base, cupo: "0" })).toBeTruthy();
    expect(validateClase({ ...base, cupo: "-5" })).toBeTruthy();
    expect(validateClase({ ...base, cupo: "abc" })).toBeTruthy();
  });

  it("acepta cupo vacío (sin límite)", () => {
    expect(validateClase({ ...base, cupo: "" })).toBeNull();
    expect(validateClase({ ...base, cupo: null })).toBeNull();
  });
});

describe("Clases del gimnasio — construcción", () => {
  it("parsea duración y cupo a números", () => {
    const clase = buildClase({ nombre: "Crossfit", diaHora: "Lunes 18:00", duracion: "60", cupo: "20", profesor: "Juan" });
    expect(typeof clase.duracion).toBe("number");
    expect(typeof clase.cupo).toBe("number");
    expect(clase.duracion).toBe(60);
    expect(clase.cupo).toBe(20);
  });

  it("setea null cuando duracion y cupo están vacíos", () => {
    const clase = buildClase({ nombre: "Yoga", diaHora: "Martes 10:00", duracion: "", cupo: "" });
    expect(clase.duracion).toBeNull();
    expect(clase.cupo).toBeNull();
  });

  it("elimina espacios en nombre y horario", () => {
    const clase = buildClase({ nombre: "  Pilates  ", diaHora: "  Miércoles 9:00  " });
    expect(clase.nombre).toBe("Pilates");
    expect(clase.diaHora).toBe("Miércoles 9:00");
  });
});

describe("Disponibilidad de clases", () => {
  const clase10 = { nombre: "Spinning", cupo: 10 };
  const claseSinCupo = { nombre: "Yoga" };

  it("tiene disponibilidad si hay lugares libres", () => {
    const reservas = Array(5).fill({ claseId: "c1" });
    expect(hasDisponibilidad(clase10, reservas)).toBe(true);
  });

  it("no tiene disponibilidad si el cupo está lleno", () => {
    const reservas = Array(10).fill({ claseId: "c1" });
    expect(hasDisponibilidad(clase10, reservas)).toBe(false);
  });

  it("siempre tiene disponibilidad si la clase no tiene cupo definido", () => {
    const reservas = Array(100).fill({ claseId: "c2" });
    expect(hasDisponibilidad(claseSinCupo, reservas)).toBe(true);
  });

  it("calcula correctamente los lugares restantes", () => {
    const reservas = Array(7).fill({});
    expect(getLugaresRestantes(clase10, reservas)).toBe(3);
  });

  it("retorna 0 si la clase está llena (no número negativo)", () => {
    const reservas = Array(15).fill({});
    expect(getLugaresRestantes(clase10, reservas)).toBe(0);
  });

  it("retorna null si la clase no tiene cupo definido", () => {
    expect(getLugaresRestantes(claseSinCupo, [])).toBeNull();
  });
});
