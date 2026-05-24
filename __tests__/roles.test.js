import { isCliente, isGymOwner, isEmpleador } from "../utils/auth";

describe("Permisos según rol — usuario (cliente)", () => {
  const rol = "usuario";

  it("es cliente", () => expect(isCliente(rol)).toBe(true));
  it("no es dueño de gimnasio", () => expect(isGymOwner(rol)).toBe(false));
  it("no es empleador", () => expect(isEmpleador(rol)).toBe(false));
});

describe("Permisos según rol — dueño de gimnasio", () => {
  const rol = "gimnasio";

  it("no es cliente", () => expect(isCliente(rol)).toBe(false));
  it("es dueño de gimnasio", () => expect(isGymOwner(rol)).toBe(true));
  it("no es empleador", () => expect(isEmpleador(rol)).toBe(false));
});

describe("Permisos según rol — empleador", () => {
  const rol = "empleador";

  it("no es cliente", () => expect(isCliente(rol)).toBe(false));
  it("no es dueño de gimnasio", () => expect(isGymOwner(rol)).toBe(false));
  it("es empleador", () => expect(isEmpleador(rol)).toBe(true));
});

describe("Solo el cliente puede reservar", () => {
  it("cliente puede reservar", () => expect(isCliente("usuario")).toBe(true));
  it("dueño no puede reservar", () => expect(isCliente("gimnasio")).toBe(false));
  it("empleador no puede reservar", () => expect(isCliente("empleador")).toBe(false));
});
