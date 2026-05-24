import {
  filterGymsByName,
  isValidGymCoordinate,
  getGymCoordinate,
  validateGymInfo,
} from "../utils/gimnasios";

const GYMS = [
  { id: "1", nombreGimnasio: "SportClub Palermo" },
  { id: "2", nombreGimnasio: "Megatlon Centro" },
  { id: "3", nombreGimnasio: "Gold's Gym" },
  { id: "4", nombreGimnasio: "sport fitness" },
];

describe("filterGymsByName", () => {
  it("filtra por nombre parcial", () => {
    const result = filterGymsByName(GYMS, "sport");
    expect(result).toHaveLength(2);
  });

  it("es case-insensitive", () => {
    expect(filterGymsByName(GYMS, "MEGATLON")).toHaveLength(1);
    expect(filterGymsByName(GYMS, "gold's")).toHaveLength(1);
  });

  it("retorna array vacío si no hay coincidencias", () => {
    expect(filterGymsByName(GYMS, "zzzzz")).toHaveLength(0);
  });

  it("retorna array vacío si la query está vacía", () => {
    expect(filterGymsByName(GYMS, "")).toHaveLength(0);
    expect(filterGymsByName(GYMS, "   ")).toHaveLength(0);
    expect(filterGymsByName(GYMS, null)).toHaveLength(0);
  });

  it("maneja gyms sin nombre", () => {
    const gymsRaros = [{ id: "1" }, { id: "2", nombreGimnasio: null }];
    expect(() => filterGymsByName(gymsRaros, "sport")).not.toThrow();
    expect(filterGymsByName(gymsRaros, "sport")).toHaveLength(0);
  });
});

describe("isValidGymCoordinate", () => {
  it("acepta coordenadas numéricas válidas", () => {
    expect(isValidGymCoordinate({ latitude: -34.6, longitude: -58.4 })).toBe(true);
    expect(isValidGymCoordinate({ latitude: "0", longitude: "0" })).toBe(true);
  });

  it("rechaza coordenadas inválidas o ausentes", () => {
    expect(isValidGymCoordinate({ latitude: "abc", longitude: -58.4 })).toBe(false);
    expect(isValidGymCoordinate({ latitude: null, longitude: null })).toBe(false);
    expect(isValidGymCoordinate({})).toBe(false);
  });
});

describe("getGymCoordinate", () => {
  it("convierte strings a números", () => {
    const coord = getGymCoordinate({ latitude: "-34.6037", longitude: "-58.3816" });
    expect(typeof coord.latitude).toBe("number");
    expect(typeof coord.longitude).toBe("number");
    expect(coord.latitude).toBeCloseTo(-34.6037);
  });
});

describe("validateGymInfo", () => {
  it("retorna null cuando todo es válido", () => {
    expect(validateGymInfo({ nombreGimnasio: "Mi Gym", direccion: "Av. Santa Fe 123" })).toBeNull();
  });

  it("falla si falta el nombre", () => {
    expect(validateGymInfo({ nombreGimnasio: "", direccion: "Av. Santa Fe 123" })).toBeTruthy();
    expect(validateGymInfo({ nombreGimnasio: "   ", direccion: "Av. Santa Fe 123" })).toBeTruthy();
  });

  it("falla si falta la dirección", () => {
    expect(validateGymInfo({ nombreGimnasio: "Mi Gym", direccion: "" })).toBeTruthy();
    expect(validateGymInfo({ nombreGimnasio: "Mi Gym", direccion: null })).toBeTruthy();
  });
});
