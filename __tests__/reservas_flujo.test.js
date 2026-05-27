import { isDuplicatePase, isDuplicateClase, buildReservaPase, buildReservaClase } from "../utils/reservas";
import { isCliente } from "../utils/auth";
import { canAccessClases, canAccessGym } from "../utils/planes";
import { hasDisponibilidad } from "../utils/clases";

const USUARIO = { uid: "user-1", rol: "usuario", plan: "platinum" };
const GYM_ID = "gym-1";
const CLASE = { id: "clase-1", nombre: "Spinning", diaHora: "Lunes 18:00", cupo: 10 };

describe("Flujo de reserva de pase", () => {
  it("un cliente puede reservar un pase", () => {
    expect(isCliente(USUARIO.rol)).toBe(true);
    const reserva = buildReservaPase({ userId: USUARIO.uid, gymId: GYM_ID, nombreGimnasio: "SportClub" });
    expect(reserva.tipo).toBe("pase");
    expect(reserva.estado).toBe("pendiente");
  });

  it("no puede reservar dos veces el mismo gimnasio", () => {
    const existentes = [buildReservaPase({ userId: USUARIO.uid, gymId: GYM_ID })];
    expect(isDuplicatePase(existentes, USUARIO.uid, GYM_ID)).toBe(true);
  });

  it("puede reservar en un gimnasio distinto", () => {
    const existentes = [buildReservaPase({ userId: USUARIO.uid, gymId: GYM_ID })];
    expect(isDuplicatePase(existentes, USUARIO.uid, "gym-2")).toBe(false);
  });

  it("dos usuarios distintos pueden reservar el mismo gym", () => {
    const existentes = [buildReservaPase({ userId: "user-1", gymId: GYM_ID })];
    expect(isDuplicatePase(existentes, "user-2", GYM_ID)).toBe(false);
  });
});

describe("Flujo de reserva de clase", () => {
  it("un cliente con plan platinum puede acceder a clases", () => {
    expect(isCliente(USUARIO.rol)).toBe(true);
    expect(canAccessClases(USUARIO.plan)).toBe(true);
  });

  it("un cliente con plan classic no puede acceder a clases grupales", () => {
    expect(canAccessClases("classic")).toBe(false);
  });

  it("puede reservar una clase si hay cupo disponible", () => {
    const reservasExistentes = Array(5).fill({});
    expect(hasDisponibilidad(CLASE, reservasExistentes)).toBe(true);
    const reserva = buildReservaClase({ userId: USUARIO.uid, gymId: GYM_ID, clase: CLASE });
    expect(reserva.claseId).toBe(CLASE.id);
    expect(reserva.tipo).toBe("clase");
  });

  it("no puede reservar si el cupo está lleno", () => {
    const reservasLlenas = Array(10).fill({});
    expect(hasDisponibilidad(CLASE, reservasLlenas)).toBe(false);
  });

  it("no puede reservar dos veces la misma clase", () => {
    const existentes = [buildReservaClase({ userId: USUARIO.uid, gymId: GYM_ID, clase: CLASE })];
    expect(isDuplicateClase(existentes, USUARIO.uid, GYM_ID, CLASE.id)).toBe(true);
  });

  it("puede reservar otra clase del mismo gimnasio", () => {
    const existentes = [buildReservaClase({ userId: USUARIO.uid, gymId: GYM_ID, clase: CLASE })];
    expect(isDuplicateClase(existentes, USUARIO.uid, GYM_ID, "clase-2")).toBe(false);
  });
});

describe("Flujo de acceso por plan", () => {
  it("usuario sin plan no puede acceder a ningún gym", () => {
    expect(canAccessGym(null, "classic")).toBe(false);
    expect(canAccessGym(null, "platinum")).toBe(false);
  });

  it("usuario classic no puede acceder a un gym platinum aunque sea cliente", () => {
    const usuario = { uid: "user-2", rol: "usuario", plan: "classic" };
    expect(isCliente(usuario.rol)).toBe(true);
    expect(canAccessGym(usuario.plan, "platinum")).toBe(false);
  });

  it("usuario platinum puede acceder a gym classic y platinum, pero no black", () => {
    expect(canAccessGym("platinum", "classic")).toBe(true);
    expect(canAccessGym("platinum", "platinum")).toBe(true);
    expect(canAccessGym("platinum", "black")).toBe(false);
  });

  it("el acceso al gym es condición previa a poder reservar clases", () => {
    const sinPlan = { uid: "user-3", rol: "usuario", plan: null };
    expect(isCliente(sinPlan.rol)).toBe(true);
    expect(canAccessGym(sinPlan.plan, "classic")).toBe(false);
  });
});
