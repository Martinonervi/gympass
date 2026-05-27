import { getDistanceKm } from "../utils/gimnasios";

// Referencia: Buenos Aires (CABA) → Palermo ≈ 3.3 km
const CABA  = { lat: -34.6037, lon: -58.3816 };
const PALERMO = { lat: -34.5755, lon: -58.4370 };

describe("getDistanceKm — fórmula de Haversine", () => {
  it("la distancia entre dos puntos conocidos es aproximadamente correcta", () => {
    const d = getDistanceKm(CABA.lat, CABA.lon, PALERMO.lat, PALERMO.lon);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(10);
  });

  it("la distancia de un punto a sí mismo es 0", () => {
    expect(getDistanceKm(CABA.lat, CABA.lon, CABA.lat, CABA.lon)).toBe(0);
  });

  it("es simétrica: A→B == B→A", () => {
    const ab = getDistanceKm(CABA.lat, CABA.lon, PALERMO.lat, PALERMO.lon);
    const ba = getDistanceKm(PALERMO.lat, PALERMO.lon, CABA.lat, CABA.lon);
    expect(ab).toBeCloseTo(ba, 5);
  });

  it("retorna kilómetros, no metros (orden de magnitud)", () => {
    const d = getDistanceKm(CABA.lat, CABA.lon, PALERMO.lat, PALERMO.lon);
    expect(d).toBeLessThan(100);
  });
});
