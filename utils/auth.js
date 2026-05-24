export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

export function isValidPassword(password) {
  return typeof password === "string" && password.length >= 6;
}

export function isValidRole(role) {
  return ["usuario", "gimnasio", "empleador"].includes(role);
}

export function validateRegisterForm({ email, password, role }) {
  if (!email || !email.trim()) return "El email es requerido.";
  if (!isValidEmail(email)) return "El email no es válido.";
  if (!password) return "La contraseña es requerida.";
  if (!isValidPassword(password)) return "La contraseña debe tener al menos 6 caracteres.";
  if (!isValidRole(role)) return "El rol seleccionado no es válido.";
  return null;
}

export function displayNameFromUser(userData, email) {
  if (userData?.nombre || userData?.apellido) {
    return `${userData.nombre || ""} ${userData.apellido || ""}`.trim();
  }
  return (email || "").split("@")[0];
}

export function isCliente(rol) {
  return rol === "usuario";
}

export function isGymOwner(rol) {
  return rol === "gimnasio";
}

export function isEmpleador(rol) {
  return rol === "empleador";
}
