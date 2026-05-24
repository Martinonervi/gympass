import { validateUserInfo, buildUserUpdate } from "../utils/usuario";

describe("Cambiar información de usuario — validaciones", () => {
  const base = { nombre: "Martin", apellido: "Nervi", telefono: "1122334455" };

  it("pasa con nombre, apellido y teléfono válidos", () => {
    expect(validateUserInfo(base)).toBeNull();
  });

  it("pasa sin teléfono (es opcional)", () => {
    expect(validateUserInfo({ nombre: "Martin", apellido: "Nervi" })).toBeNull();
    expect(validateUserInfo({ nombre: "Martin", apellido: "Nervi", telefono: "" })).toBeNull();
  });

  it("falla si falta el nombre", () => {
    expect(validateUserInfo({ ...base, nombre: "" })).toBeTruthy();
    expect(validateUserInfo({ ...base, nombre: "   " })).toBeTruthy();
  });

  it("falla si falta el apellido", () => {
    expect(validateUserInfo({ ...base, apellido: "" })).toBeTruthy();
  });

  it("falla con teléfono en formato inválido", () => {
    expect(validateUserInfo({ ...base, telefono: "abc" })).toBeTruthy();
    expect(validateUserInfo({ ...base, telefono: "12" })).toBeTruthy();
  });

  it("acepta teléfonos con código de país", () => {
    expect(validateUserInfo({ ...base, telefono: "+54 11 2233-4455" })).toBeNull();
  });
});

describe("Cambiar información de usuario — construcción del update", () => {
  it("incluye nombre y apellido siempre", () => {
    const update = buildUserUpdate({ nombre: "Martin", apellido: "Nervi", telefono: "" });
    expect(update.nombre).toBe("Martin");
    expect(update.apellido).toBe("Nervi");
  });

  it("incluye teléfono solo si está presente", () => {
    const conTel = buildUserUpdate({ nombre: "Martin", apellido: "Nervi", telefono: "1122334455" });
    expect(conTel.telefono).toBe("1122334455");

    const sinTel = buildUserUpdate({ nombre: "Martin", apellido: "Nervi", telefono: "" });
    expect(sinTel.telefono).toBeUndefined();
  });

  it("elimina espacios en los extremos", () => {
    const update = buildUserUpdate({ nombre: "  Martin  ", apellido: "  Nervi  ", telefono: "" });
    expect(update.nombre).toBe("Martin");
    expect(update.apellido).toBe("Nervi");
  });
});
