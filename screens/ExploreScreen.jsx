import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import * as Location from "expo-location";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  text: "#ffffff",
  textMuted: "#94a3b8",
  border: "#243244",
  overlay: "rgba(0,0,0,0.6)",
};

const DISTANCE_OPTIONS = [
  { label: "Todos", value: null },
  { label: "Menos de 1 km", value: 1 },
  { label: "Menos de 5 km", value: 5 },
  { label: "Menos de 10 km", value: 10 },
];

function getDistanceKm(lat1, lon1, lat2, lon2) {
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

export default function ExploreScreen({ navigation }) {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    async function fetchGyms() {
      try {
        const snapshot = await getDocs(collection(db, "gimnasios"));
        const loadedGyms = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setGyms(loadedGyms);
      } catch (error) {
        console.error("Error fetching gyms:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchGyms();
  }, []);

  useEffect(() => {
    async function fetchLocation() {
      setLocationLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        // Caché primero para respuesta rápida
        const cached = await Location.getLastKnownPositionAsync({});
        if (cached) {
          setUserLocation({ lat: cached.coords.latitude, lng: cached.coords.longitude });
        }

        // Actualizar con posición fresca
        const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        setUserLocation({ lat: fresh.coords.latitude, lng: fresh.coords.longitude });
      } catch (e) {
        console.error("Error getting location:", e);
      } finally {
        setLocationLoading(false);
      }
    }
    fetchLocation();
  }, []);

  const displayedGyms = gyms
    .filter((g) => {
      const name = g.nombreGimnasio || g.nombre || "";
      if (query && !name.toLowerCase().includes(query.toLowerCase())) return false;
      if (distanceFilter !== null && userLocation) {
        const lat = Number(g.latitude);
        const lng = Number(g.longitude);
        if (isNaN(lat) || isNaN(lng)) return false;
        const dist = getDistanceKm(userLocation.lat, userLocation.lng, lat, lng);
        if (dist > distanceFilter) return false;
      }
      return true;
    })
    .map((g) => {
      if (!userLocation) return { ...g, distance: null };
      const lat = Number(g.latitude);
      const lng = Number(g.longitude);
      if (isNaN(lat) || isNaN(lng)) return { ...g, distance: null };
      return {
        ...g,
        distance: getDistanceKm(userLocation.lat, userLocation.lng, lat, lng),
      };
    })
    .sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

  const activeFilterLabel =
    DISTANCE_OPTIONS.find((o) => o.value === distanceFilter)?.label || "Todos";

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("GymDetail", { gymId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.nombreGimnasio || item.nombre || "Gimnasio sin nombre"}
        </Text>
        {item.distance !== null && (
          <Text style={styles.distanceBadge}>
            {item.distance < 1
              ? `${Math.round(item.distance * 1000)} m`
              : `${item.distance.toFixed(1)} km`}
          </Text>
        )}
      </View>
      <Text style={styles.cardAddress} numberOfLines={1}>
        {item.direccion || "Dirección no especificada"}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ActivityIndicator size="large" color={COLORS.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <Text style={styles.title}>Explorar Gimnasios</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre..."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <MaterialCommunityIcons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate("Map")}
        >
          <Ionicons name="map-outline" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, distanceFilter !== null && styles.iconButtonActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={20}
            color={distanceFilter !== null ? COLORS.bg : COLORS.textMuted}
          />
        </TouchableOpacity>
      </View>

      {distanceFilter !== null && (
        <View style={styles.activeFilterRow}>
          <MaterialCommunityIcons name="map-marker-radius-outline" size={14} color={COLORS.green} />
          <Text style={styles.activeFilterText}>{activeFilterLabel}</Text>
          {locationLoading && (
            <ActivityIndicator size="small" color={COLORS.green} style={{ marginLeft: 6 }} />
          )}
          <TouchableOpacity onPress={() => setDistanceFilter(null)} style={{ marginLeft: 4 }}>
            <MaterialCommunityIcons name="close" size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={displayedGyms}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {distanceFilter !== null && !userLocation
              ? "Esperando ubicación..."
              : "No se encontraron gimnasios."}
          </Text>
        }
      />

      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <Pressable style={styles.modalBox} onPress={() => {}}>
            <Text style={styles.modalTitle}>Filtrar por distancia</Text>
            {DISTANCE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={[
                  styles.modalOption,
                  distanceFilter === opt.value && styles.modalOptionActive,
                ]}
                onPress={() => {
                  setDistanceFilter(opt.value);
                  setShowFilterModal(false);
                }}
              >
                <MaterialCommunityIcons
                  name={opt.value === null ? "filter-off-outline" : "map-marker-radius-outline"}
                  size={18}
                  color={distanceFilter === opt.value ? COLORS.bg : COLORS.green}
                />
                <Text
                  style={[
                    styles.modalOptionText,
                    distanceFilter === opt.value && styles.modalOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 10,
  },
  title: { color: COLORS.text, fontSize: 26, fontWeight: "800" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    gap: 10,
    marginBottom: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 14 },
  iconButton: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconButtonActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    marginBottom: 10,
    gap: 4,
  },
  activeFilterText: { color: COLORS.green, fontSize: 12, fontWeight: "600" },
  listContainer: { paddingHorizontal: 22, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { color: COLORS.green, fontSize: 18, fontWeight: "700", flex: 1 },
  distanceBadge: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "#1e2a36",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  cardAddress: { color: COLORS.textMuted, fontSize: 14 },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    width: "80%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700", marginBottom: 20 },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalOptionActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  modalOptionText: { color: COLORS.text, fontSize: 15 },
  modalOptionTextActive: { color: COLORS.bg, fontWeight: "700" },
});
