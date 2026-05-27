import { canAccessGym } from "../utils/planes";

describe("canAccessGym — jerarquía de planes", () => {
  it("sin plan no puede acceder a ningún gym", () => {
    expect(canAccessGym(null, "classic")).toBe(false);
    expect(canAccessGym(null, "platinum")).toBe(false);
    expect(canAccessGym(null, "black")).toBe(false);
    expect(canAccessGym(null, null)).toBe(false);
  });

  it("classic accede a gyms classic pero no a niveles superiores", () => {
    expect(canAccessGym("classic", "classic")).toBe(true);
    expect(canAccessGym("classic", "platinum")).toBe(false);
    expect(canAccessGym("classic", "black")).toBe(false);
  });

  it("platinum accede a classic y platinum pero no a black", () => {
    expect(canAccessGym("platinum", "classic")).toBe(true);
    expect(canAccessGym("platinum", "platinum")).toBe(true);
    expect(canAccessGym("platinum", "black")).toBe(false);
  });

  it("black accede a todo", () => {
    expect(canAccessGym("black", "classic")).toBe(true);
    expect(canAccessGym("black", "platinum")).toBe(true);
    expect(canAccessGym("black", "black")).toBe(true);
  });

  it("un gym sin planGimnasio es accesible con cualquier plan", () => {
    expect(canAccessGym("classic", null)).toBe(true);
    expect(canAccessGym("platinum", null)).toBe(true);
    expect(canAccessGym("black", null)).toBe(true);
  });

  it("un gym sin planGimnasio no es accesible sin plan", () => {
    expect(canAccessGym(null, null)).toBe(false);
  });
});
