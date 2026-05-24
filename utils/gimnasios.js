export function filterGymsByName(gyms, query) {
  if (!query || !query.trim()) return [];
  const q = query.toLowerCase().trim();
  return gyms.filter((g) =>
    (g.nombreGimnasio || "").toLowerCase().includes(q)
  );
}

export function isValidGymCoordinate(gym) {
  if (gym.latitude == null || gym.longitude == null) return false;
  const lat = Number(gym.latitude);
  const lng = Number(gym.longitude);
  return !isNaN(lat) && !isNaN(lng);
}

export function getGymCoordinate(gym) {
  return {
    latitude: Number(gym.latitude),
    longitude: Number(gym.longitude),
  };
}

export function validateGymInfo({ nombreGimnasio, direccion }) {
  if (!nombreGimnasio || !nombreGimnasio.trim()) return "El nombre del gimnasio es requerido.";
  if (!direccion || !direccion.trim()) return "La dirección es requerida.";
  return null;
}
