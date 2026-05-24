import {
  isValidEmail,
  isValidPassword,
  isValidRole,
  validateRegisterForm,
  displayNameFromUser,
  isCliente,
  isGymOwner,
  isEmpleador,
} from "../utils/auth";

describe("isValidEmail", () => {
  it("acepta emails válidos", () => {
    expect(isValidEmail("usuario@gmail.com")).toBe(true);
    expect(isValidEmail("test.user+tag@domain.co")).toBe(true);
  });

  it("rechaza emails inválidos", () => {
    expect(isValidEmail("sinArroba")).toBe(false);
    expect(isValidEmail("@sinUsuario.com")).toBe(false);
    expect(isValidEmail("sin@dominio")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });

  it("ignora espacios al principio y al final", () => {
    expect(isValidEmail("  usuario@gmail.com  ")).toBe(true);
  });
});

describe("isValidPassword", () => {
  it("acepta contraseñas de 6 o más caracteres", () => {
    expect(isValidPassword("123456")).toBe(true);
    expect(isValidPassword("contraseñaLarga123!")).toBe(true);
  });

  it("rechaza contraseñas cortas o inválidas", () => {
    expect(isValidPassword("12345")).toBe(false);
    expect(isValidPassword("")).toBe(false);
    expect(isValidPassword(null)).toBe(false);
  });
});

describe("isValidRole", () => {
  it("acepta los tres roles válidos", () => {
    expect(isValidRole("usuario")).toBe(true);
    expect(isValidRole("gimnasio")).toBe(true);
    expect(isValidRole("empleador")).toBe(true);
  });

  it("rechaza roles desconocidos", () => {
    expect(isValidRole("admin")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole(null)).toBe(false);
  });
});

describe("validateRegisterForm", () => {
  const base = { email: "test@test.com", password: "123456", role: "usuario" };

  it("retorna null cuando todo es válido", () => {
    expect(validateRegisterForm(base)).toBeNull();
  });

  it("falla si falta el email", () => {
    expect(validateRegisterForm({ ...base, email: "" })).toBeTruthy();
    expect(validateRegisterForm({ ...base, email: "   " })).toBeTruthy();
  });

  it("falla si el email es inválido", () => {
    expect(validateRegisterForm({ ...base, email: "noesvalido" })).toBeTruthy();
  });

  it("falla si la contraseña es muy corta", () => {
    expect(validateRegisterForm({ ...base, password: "123" })).toBeTruthy();
  });

  it("falla si el rol no es válido", () => {
    expect(validateRegisterForm({ ...base, role: "superadmin" })).toBeTruthy();
  });
});

describe("displayNameFromUser", () => {
  it("usa nombre y apellido si existen", () => {
    expect(displayNameFromUser({ nombre: "Martin", apellido: "Nervi" }, "m@m.com")).toBe("Martin Nervi");
  });

  it("usa solo el nombre si no hay apellido", () => {
    expect(displayNameFromUser({ nombre: "Martin" }, "m@m.com")).toBe("Martin");
  });

  it("usa la parte del email si no hay nombre ni apellido", () => {
    expect(displayNameFromUser({}, "martin@gmail.com")).toBe("martin");
  });

  it("maneja userData nulo", () => {
    expect(displayNameFromUser(null, "martin@gmail.com")).toBe("martin");
  });
});

describe("helpers de rol", () => {
  it("isCliente detecta usuario", () => {
    expect(isCliente("usuario")).toBe(true);
    expect(isCliente("gimnasio")).toBe(false);
  });

  it("isGymOwner detecta gimnasio", () => {
    expect(isGymOwner("gimnasio")).toBe(true);
    expect(isGymOwner("usuario")).toBe(false);
  });

  it("isEmpleador detecta empleador", () => {
    expect(isEmpleador("empleador")).toBe(true);
    expect(isEmpleador("usuario")).toBe(false);
  });
});
