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

export function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
