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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { collection, getDocs } from "firebase/firestore";
import { fetchGymCongestion } from "../utils/congestion";
import { db } from "../firebaseConfig";
import * as Location from "expo-location";
import { PLAN_ORDER, canAccessGym } from "../utils/planes";
import { getDistanceKm } from "../utils/gimnasios";

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
  { label: "Cualquier distancia", value: null },
  { label: "Menos de 1 km", value: 1 },
  { label: "Menos de 5 km", value: 5 },
  { label: "Menos de 10 km", value: 10 },
];

const ACTIVIDADES_PRESET = [
  "Musculación", "Spinning", "Yoga", "Pilates", "Funcional",
  "Natación", "Stretching", "Crossfit", "Boxeo", "Zumba",
];

const PLAN_LABELS = { classic: "Classic", platinum: "Platinum", black: "Black" };
const PLAN_COLORS = { classic: "#64748b", platinum: "#8b5cf6", black: "#f59e0b" };

const OCCUPANCY_EMOJIS  = ['😊', '😐', '😕', '😰'];
const OCCUPANCY_LABELS  = ['Tranquilo', 'Normal', 'Concurrido', 'Muy lleno'];
const OCCUPANCY_BORDERS = ['#16a34a', '#ca8a04', '#ea580c', '#dc2626'];
const PLAN_OPTIONS = [
  { id: null,       label: "Cualquier plan" },
  { id: "classic",  label: "Classic"  },
  { id: "platinum", label: "Platinum" },
  { id: "black",    label: "Black"    },
];

export default function ExploreScreen({ navigation }) {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState(null);
  const [activityFilter, setActivityFilter] = useState([]);
  const [planFilter, setPlanFilter] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [congestionMap, setCongestionMap] = useState({}); // { gymId: 0-3 }

  useEffect(() => {
    async function fetchGyms() {
      try {
        const snapshot = await getDocs(collection(db, "gimnasios"));
        const loadedGyms = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setGyms(loadedGyms);
        // Fire congestion fetch in background (non-blocking)
        fetchAllCongestion(loadedGyms.map((g) => g.id));
      } catch (error) {
        console.error("Error fetching gyms:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchGyms();
  }, []);

  async function fetchAllCongestion(gymIds) {
    try {
      const entries = await Promise.all(
        gymIds.map(async (gymId) => [gymId, await fetchGymCongestion(gymId)])
      );
      setCongestionMap(Object.fromEntries(entries));
    } catch (e) {
      console.log("fetchAllCongestion error:", e?.message);
    }
  }

  useEffect(() => {
    async function fetchLocation() {
      setLocationLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const cached = await Location.getLastKnownPositionAsync({});
        if (cached) setUserLocation({ lat: cached.coords.latitude, lng: cached.coords.longitude });
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
      if (activityFilter.length > 0 && !activityFilter.some((a) => (g.actividades || []).includes(a))) return false;
      if (planFilter !== null) {
        const gymLevel = PLAN_ORDER[g.planGimnasio || "classic"] ?? 0;
        if (gymLevel > (PLAN_ORDER[planFilter] ?? 0)) return false;
      }
      if (distanceFilter !== null && userLocation) {
        const lat = Number(g.latitude);
        const lng = Number(g.longitude);
        if (isNaN(lat) || isNaN(lng)) return false;
        if (getDistanceKm(userLocation.lat, userLocation.lng, lat, lng) > distanceFilter) return false;
      }
      return true;
    })
    .map((g) => {
      if (!userLocation) return { ...g, distance: null };
      const lat = Number(g.latitude);
      const lng = Number(g.longitude);
      if (isNaN(lat) || isNaN(lng)) return { ...g, distance: null };
      return { ...g, distance: getDistanceKm(userLocation.lat, userLocation.lng, lat, lng) };
    })
    .sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

  const hasActiveFilters = distanceFilter !== null || activityFilter.length > 0 || planFilter !== null;
  const activeFilterCount = (distanceFilter !== null ? 1 : 0) + activityFilter.length + (planFilter !== null ? 1 : 0);

  const clearAllFilters = () => {
    setDistanceFilter(null);
    setActivityFilter([]);
    setPlanFilter(null);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("GymDetail", { gymId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.nombreGimnasio || item.nombre || "Gimnasio sin nombre"}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {/* Congestion dot */}
          {congestionMap[item.id] !== undefined && (
            <View style={[
              styles.congestionBadge,
              { borderColor: OCCUPANCY_BORDERS[congestionMap[item.id]] },
            ]}>
              <Text style={{ fontSize: 11 }}>{OCCUPANCY_EMOJIS[congestionMap[item.id]]}</Text>
              <Text style={styles.congestionBadgeText}>
                {OCCUPANCY_LABELS[congestionMap[item.id]]}
              </Text>
            </View>
          )}
          {(() => {
            const plan = item.planGimnasio || "classic";
            return (
              <View style={[styles.planBadge, {
                backgroundColor: PLAN_COLORS[plan] + "22",
                borderColor: PLAN_COLORS[plan],
              }]}>
                <Text style={[styles.planBadgeText, { color: PLAN_COLORS[plan] }]}>
                  {PLAN_LABELS[plan]}
                </Text>
              </View>
            );
          })()}
          {item.distance !== null && (
            <Text style={styles.distanceBadge}>
              {item.distance < 1
                ? `${Math.round(item.distance * 1000)} m`
                : `${item.distance.toFixed(1)} km`}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.cardAddress} numberOfLines={1}>
        {item.direccion || "Dirección no especificada"}
      </Text>
      {item.actividades?.length > 0 && (
        <Text style={styles.cardActividades} numberOfLines={1}>
          {item.actividades.slice(0, 4).join(" · ")}
        </Text>
      )}
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

        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate("Map")}>
          <Ionicons name="map-outline" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, hasActiveFilters && styles.iconButtonActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={20}
            color={hasActiveFilters ? COLORS.bg : COLORS.textMuted}
          />
        </TouchableOpacity>
      </View>

      {hasActiveFilters && (
        <View style={styles.activeFilterRow}>
          {distanceFilter !== null && (
            <View style={styles.filterChip}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={12} color={COLORS.green} />
              <Text style={styles.filterChipText}>
                {DISTANCE_OPTIONS.find((o) => o.value === distanceFilter)?.label}
              </Text>
              <TouchableOpacity onPress={() => setDistanceFilter(null)}>
                <MaterialCommunityIcons name="close" size={12} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          )}
          {planFilter !== null && (
            <View style={[styles.filterChip, { borderColor: PLAN_COLORS[planFilter] }]}>
              <MaterialCommunityIcons name="star-circle-outline" size={12} color={PLAN_COLORS[planFilter]} />
              <Text style={[styles.filterChipText, { color: PLAN_COLORS[planFilter] }]}>
                {PLAN_LABELS[planFilter]}
              </Text>
              <TouchableOpacity onPress={() => setPlanFilter(null)}>
                <MaterialCommunityIcons name="close" size={12} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          )}
          {activityFilter.map((act) => (
            <View key={act} style={styles.filterChip}>
              <MaterialCommunityIcons name="dumbbell" size={12} color={COLORS.green} />
              <Text style={styles.filterChipText}>{act}</Text>
              <TouchableOpacity onPress={() => setActivityFilter((prev) => prev.filter((a) => a !== act))}>
                <MaterialCommunityIcons name="close" size={12} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          {locationLoading && <ActivityIndicator size="small" color={COLORS.green} />}
          {activeFilterCount >= 2 && (
            <TouchableOpacity onPress={clearAllFilters}>
              <Text style={styles.clearAll}>Limpiar todo</Text>
            </TouchableOpacity>
          )}
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
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Filtros</Text>

              <Text style={styles.modalSectionTitle}>Plan</Text>
              {PLAN_OPTIONS.map((opt) => {
                const color = opt.id ? PLAN_COLORS[opt.id] : COLORS.textMuted;
                const isSelected = planFilter === opt.id;
                return (
                  <TouchableOpacity
                    key={String(opt.id)}
                    style={[
                      styles.modalOption,
                      isSelected && { backgroundColor: color + "22", borderColor: color },
                    ]}
                    onPress={() => setPlanFilter(opt.id)}
                  >
                    <MaterialCommunityIcons
                      name={opt.id ? "star-circle-outline" : "filter-off-outline"}
                      size={18}
                      color={isSelected ? color : COLORS.textMuted}
                    />
                    <Text style={[styles.modalOptionText, isSelected && { color: color, fontWeight: "700" }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={styles.modalSectionTitle}>Distancia</Text>
              {DISTANCE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[styles.modalOption, distanceFilter === opt.value && styles.modalOptionActive]}
                  onPress={() => setDistanceFilter(opt.value)}
                >
                  <MaterialCommunityIcons
                    name={opt.value === null ? "filter-off-outline" : "map-marker-radius-outline"}
                    size={18}
                    color={distanceFilter === opt.value ? COLORS.bg : COLORS.green}
                  />
                  <Text style={[styles.modalOptionText, distanceFilter === opt.value && styles.modalOptionTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.modalSectionTitle}>Actividad</Text>
              <View style={styles.activityChipsWrap}>
                <TouchableOpacity
                  style={[styles.activityChip, activityFilter.length === 0 && styles.activityChipActive]}
                  onPress={() => setActivityFilter([])}
                >
                  <Text style={[styles.activityChipText, activityFilter.length === 0 && styles.activityChipTextActive]}>
                    Todas
                  </Text>
                </TouchableOpacity>
                {ACTIVIDADES_PRESET.map((act) => (
                  <TouchableOpacity
                    key={act}
                    style={[styles.activityChip, activityFilter.includes(act) && styles.activityChipActive]}
                    onPress={() =>
                      setActivityFilter((prev) =>
                        prev.includes(act) ? prev.filter((a) => a !== act) : [...prev, act]
                      )
                    }
                  >
                    <Text style={[styles.activityChipText, activityFilter.includes(act) && styles.activityChipTextActive]}>
                      {act}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.applyButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 10 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: "800" },
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, gap: 10, marginBottom: 8 },
  searchBar: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 14 },
  iconButton: { backgroundColor: COLORS.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  iconButtonActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  activeFilterRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, marginBottom: 10, gap: 6, flexWrap: "wrap" },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#0a1f0e", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.green,
  },
  filterChipText: { color: COLORS.green, fontSize: 12, fontWeight: "600" },
  clearAll: { color: COLORS.textMuted, fontSize: 12, textDecorationLine: "underline" },
  listContainer: { paddingHorizontal: 22, paddingBottom: 40 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { color: COLORS.green, fontSize: 18, fontWeight: "700", flex: 1 },
  distanceBadge: {
    color: COLORS.textMuted, fontSize: 12, fontWeight: "600",
    backgroundColor: "#1e2a36", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8,
  },
  cardAddress: { color: COLORS.textMuted, fontSize: 14, marginBottom: 4 },
  cardActividades: { color: "#4a6a5a", fontSize: 12, marginTop: 2 },
  planBadge: {
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1,
  },
  planBadgeText: { fontSize: 10, fontWeight: "700" },
  congestionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#1a2535",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#243244",
  },
  congestionBadgeText: { fontSize: 10, color: COLORS.textMuted, fontWeight: "600" },
  emptyText: { color: COLORS.textMuted, fontSize: 16, textAlign: "center", marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: COLORS.card, borderRadius: 20, padding: 24, width: "88%", borderWidth: 1, borderColor: COLORS.border, maxHeight: "80%" },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700", marginBottom: 16 },
  modalSectionTitle: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginTop: 6 },
  modalOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12,
    marginBottom: 6, borderWidth: 1, borderColor: COLORS.border,
  },
  modalOptionActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  modalOptionText: { color: COLORS.text, fontSize: 14 },
  modalOptionTextActive: { color: COLORS.bg, fontWeight: "700" },
  activityChipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  activityChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.input,
  },
  activityChipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  activityChipText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "500" },
  activityChipTextActive: { color: COLORS.bg, fontWeight: "700" },
  applyButton: { backgroundColor: "#16a34a", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  applyButtonText: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
});
