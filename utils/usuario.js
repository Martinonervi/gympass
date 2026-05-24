export function validateUserInfo({ nombre, apellido, telefono }) {
  if (!nombre || !nombre.trim()) return "El nombre es requerido.";
  if (!apellido || !apellido.trim()) return "El apellido es requerido.";
  if (telefono && !/^\+?[\d\s\-()]{6,20}$/.test(telefono.trim())) {
    return "El teléfono no es válido.";
  }
  return null;
}

export function buildUserUpdate({ nombre, apellido, telefono }) {
  const update = {
    nombre: nombre.trim(),
    apellido: apellido.trim(),
  };
  if (telefono && telefono.trim()) {
    update.telefono = telefono.trim();
  }
  return update;
}

export function validateLoginForm({ email, password }) {
  if (!email || !email.trim()) return "El email es requerido.";
  if (!password) return "La contraseña es requerida.";
  return null;
}
