import { validateLoginForm } from "../utils/usuario";
import { validateRegisterForm, isValidRole } from "../utils/auth";

describe("Login — validación de formulario", () => {
  it("pasa con email y contraseña válidos", () => {
    expect(validateLoginForm({ email: "user@gmail.com", password: "123456" })).toBeNull();
  });

  it("falla si el email está vacío", () => {
    expect(validateLoginForm({ email: "", password: "123456" })).toBeTruthy();
  });

  it("falla si la contraseña está vacía", () => {
    expect(validateLoginForm({ email: "user@gmail.com", password: "" })).toBeTruthy();
  });

  it("falla si ambos campos están vacíos", () => {
    expect(validateLoginForm({ email: "", password: "" })).toBeTruthy();
  });
});

describe("Registro — los 3 roles son válidos", () => {
  const base = { email: "test@test.com", password: "123456" };

  it("usuario puede registrarse", () => {
    expect(validateRegisterForm({ ...base, role: "usuario" })).toBeNull();
  });

  it("dueño de gimnasio puede registrarse", () => {
    expect(validateRegisterForm({ ...base, role: "gimnasio" })).toBeNull();
  });

  it("empleador puede registrarse", () => {
    expect(validateRegisterForm({ ...base, role: "empleador" })).toBeNull();
  });

  it("no se puede registrar con un rol inventado", () => {
    expect(validateRegisterForm({ ...base, role: "admin" })).toBeTruthy();
    expect(validateRegisterForm({ ...base, role: "" })).toBeTruthy();
  });
});

describe("Registro — validaciones de campos", () => {
  const base = { email: "test@test.com", password: "123456", role: "usuario" };

  it("falla con email sin @", () => {
    expect(validateRegisterForm({ ...base, email: "noesvalido" })).toBeTruthy();
  });

  it("falla con contraseña de menos de 6 caracteres", () => {
    expect(validateRegisterForm({ ...base, password: "12345" })).toBeTruthy();
  });

  it("acepta contraseñas largas y con caracteres especiales", () => {
    expect(validateRegisterForm({ ...base, password: "M1C0ntr4seña!@#" })).toBeNull();
  });
});
