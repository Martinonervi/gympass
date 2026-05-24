import {
  buildReservaPase,
  buildReservaClase,
  isDuplicatePase,
  isDuplicateClase,
  sortReservasByDate,
  formatReservaDate,
  filterReservasByUser,
  filterReservasByGym,
} from "../utils/reservas";

const USUARIO_ID = "user-123";
const GYM_ID = "gym-abc";

const CLASE = { id: "clase-1", nombre: "Crossfit", diaHora: "Lunes 18:00" };

describe("buildReservaPase", () => {
  it("genera la estructura correcta", () => {
    const reserva = buildReservaPase({
      userId: USUARIO_ID,
      gymId: GYM_ID,
      nombreGimnasio: "SportClub",
    });
    expect(reserva.tipo).toBe("pase");
    expect(reserva.userId).toBe(USUARIO_ID);
    expect(reserva.gymId).toBe(GYM_ID);
    expect(reserva.estado).toBe("pendiente");
    expect(reserva.nombreGimnasio).toBe("SportClub");
  });

  it("usa string vacío si no hay nombre de gimnasio", () => {
    const reserva = buildReservaPase({ userId: USUARIO_ID, gymId: GYM_ID });
    expect(reserva.nombreGimnasio).toBe("");
  });
});

describe("buildReservaClase", () => {
  it("genera la estructura correcta con datos de la clase", () => {
    const reserva = buildReservaClase({
      userId: USUARIO_ID,
      gymId: GYM_ID,
      nombreGimnasio: "SportClub",
      clase: CLASE,
    });
    expect(reserva.tipo).toBe("clase");
    expect(reserva.claseId).toBe(CLASE.id);
    expect(reserva.nombreClase).toBe(CLASE.nombre);
    expect(reserva.diaHora).toBe(CLASE.diaHora);
    expect(reserva.estado).toBe("pendiente");
  });
});

describe("isDuplicatePase", () => {
  const existentes = [
    { userId: USUARIO_ID, gymId: GYM_ID, tipo: "pase" },
    { userId: USUARIO_ID, gymId: "otro-gym", tipo: "pase" },
  ];

  it("detecta un pase duplicado", () => {
    expect(isDuplicatePase(existentes, USUARIO_ID, GYM_ID)).toBe(true);
  });

  it("no marca como duplicado si es otro gimnasio", () => {
    expect(isDuplicatePase(existentes, USUARIO_ID, "gym-nuevo")).toBe(false);
  });

  it("no marca como duplicado si es otro usuario", () => {
    expect(isDuplicatePase(existentes, "otro-user", GYM_ID)).toBe(false);
  });

  it("retorna false si no hay reservas", () => {
    expect(isDuplicatePase([], USUARIO_ID, GYM_ID)).toBe(false);
  });
});

describe("isDuplicateClase", () => {
  const existentes = [
    { userId: USUARIO_ID, gymId: GYM_ID, tipo: "clase", claseId: "clase-1" },
  ];

  it("detecta una clase duplicada", () => {
    expect(isDuplicateClase(existentes, USUARIO_ID, GYM_ID, "clase-1")).toBe(true);
  });

  it("permite reservar una clase distinta del mismo gym", () => {
    expect(isDuplicateClase(existentes, USUARIO_ID, GYM_ID, "clase-2")).toBe(false);
  });

  it("no confunde pases con clases", () => {
    const soloPase = [{ userId: USUARIO_ID, gymId: GYM_ID, tipo: "pase" }];
    expect(isDuplicateClase(soloPase, USUARIO_ID, GYM_ID, "clase-1")).toBe(false);
  });
});

describe("sortReservasByDate", () => {
  it("ordena de más reciente a más antigua", () => {
    const reservas = [
      { id: "a", fecha: { seconds: 1000 } },
      { id: "b", fecha: { seconds: 3000 } },
      { id: "c", fecha: { seconds: 2000 } },
    ];
    const sorted = sortReservasByDate(reservas);
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("c");
    expect(sorted[2].id).toBe("a");
  });

  it("no muta el array original", () => {
    const reservas = [
      { id: "a", fecha: { seconds: 1000 } },
      { id: "b", fecha: { seconds: 2000 } },
    ];
    sortReservasByDate(reservas);
    expect(reservas[0].id).toBe("a");
  });

  it("maneja reservas sin fecha", () => {
    const reservas = [
      { id: "a", fecha: null },
      { id: "b", fecha: { seconds: 1000 } },
    ];
    expect(() => sortReservasByDate(reservas)).not.toThrow();
  });
});

describe("formatReservaDate", () => {
  it("formatea un timestamp de Firestore correctamente", () => {
    const timestamp = { seconds: 1748044800 }; // una fecha fija
    const result = formatReservaDate(timestamp);
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("retorna string vacío si no hay timestamp", () => {
    expect(formatReservaDate(null)).toBe("");
    expect(formatReservaDate(undefined)).toBe("");
    expect(formatReservaDate({})).toBe("");
  });
});

describe("filterReservasByUser", () => {
  const reservas = [
    { id: "1", userId: "user-A" },
    { id: "2", userId: "user-B" },
    { id: "3", userId: "user-A" },
  ];

  it("filtra solo las reservas del usuario dado", () => {
    const result = filterReservasByUser(reservas, "user-A");
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.userId === "user-A")).toBe(true);
  });

  it("retorna array vacío si el usuario no tiene reservas", () => {
    expect(filterReservasByUser(reservas, "user-C")).toHaveLength(0);
  });
});

describe("filterReservasByGym", () => {
  const reservas = [
    { id: "1", gymId: "gym-X" },
    { id: "2", gymId: "gym-Y" },
    { id: "3", gymId: "gym-X" },
  ];

  it("filtra solo las reservas del gimnasio dado", () => {
    const result = filterReservasByGym(reservas, "gym-X");
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.gymId === "gym-X")).toBe(true);
  });

  it("retorna array vacío si el gym no tiene reservas", () => {
    expect(filterReservasByGym(reservas, "gym-Z")).toHaveLength(0);
  });
});
