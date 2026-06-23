import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";
import { auth, db } from "../firebaseConfig";
import ScreenHeader from "../components/ScreenHeader";

const C = {
  bg:       "#0f1520",
  card:     "#152030",
  cardDark: "#0d1824",
  green:    "#22c55e",
  greenDark:"#16a34a",
  amber:    "#f59e0b",
  border:   "#1e2a36",
  text:     "#ffffff",
  muted:    "#6b7f95",
};

const TABS = [
  { key: "activas", label: "Activas" },
  { key: "usadas",  label: "Usadas"  },
];

function formatFecha(ts) {
  if (!ts?.seconds) return null;
  return new Date(ts.seconds * 1000).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function TipoBadge({ tipo }) {
  const isClase = tipo === "clase";
  return (
    <View style={[styles.badge, isClase ? styles.badgeClase : styles.badgePase]}>
      <Text style={styles.badgeText}>{isClase ? "Clase" : "Pase"}</Text>
    </View>
  );
}

function ReservaCard({ item, usada }) {
  const nombre = item.nombreGimnasio || item.actividad || item.nombreClase || "Reserva";
  const sub = item.tipo === "clase"
    ? (item.claseFechaDisplay || item.diaHora || null)
    : formatFecha(item.fecha);

  return (
    <View style={[styles.card, usada && styles.cardUsada]}>
      <View style={styles.cardRow}>
        <View style={[styles.iconWrap, usada && styles.iconWrapUsada]}>
          <MaterialCommunityIcons
            name={item.tipo === "clase" ? "account-group" : "ticket-confirmation-outline"}
            size={20}
            color={usada ? C.muted : C.green}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <TipoBadge tipo={item.tipo} />
            <Text style={[styles.cardNombre, usada && styles.cardNombreUsada]} numberOfLines={1}>
              {nombre}
            </Text>
          </View>
          {!!sub && <Text style={styles.cardSub}>{sub}</Text>}
        </View>
        {usada && (
          <Ionicons name="checkmark-circle" size={18} color={C.green} style={{ marginLeft: 8 }} />
        )}
      </View>
      {usada && formatFecha(item.validadoEn) && (
        <View style={styles.validadaRow}>
          <MaterialCommunityIcons name="check-circle-outline" size={12} color={C.green} />
          <Text style={styles.validadaText}>Validada el {formatFecha(item.validadoEn)}</Text>
        </View>
      )}
    </View>
  );
}

export default function HistorialScreen({ navigation }) {
  const [activas, setActivas]     = useState([]);
  const [usadas, setUsadas]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("activas");
  const didLoadRef = useRef(false);

  const fetchData = useCallback(async ({ isRefresh = false } = {}) => {
    // El spinner de pantalla completa solo en la primera carga; los refrescos
    // por focus se hacen en segundo plano sin tapar el contenido ya cargado.
    if (isRefresh) setRefreshing(true);
    else if (!didLoadRef.current) setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const snap = await getDocs(
        query(collection(db, "reservas"), where("userId", "==", user.uid), limit(100))
      );

      const now = new Date();
      const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
      const todayStr = now.toISOString().slice(0, 10);

      const isExpired = (r) => {
        if (r.tipo === "pase") {
          return r.fecha?.seconds ? new Date(r.fecha.seconds * 1000) < todayMidnight : false;
        }
        if (r.tipo === "clase") {
          if (!r.claseFecha) return false;
          if (r.claseFecha < todayStr) return true;
          if (r.claseFecha === todayStr && r.horaFin) {
            const [h, m] = r.horaFin.split(":").map(Number);
            const [y, mo, d] = todayStr.split("-").map(Number);
            return new Date(y, mo - 1, d, h, m, 0, 0) <= now;
          }
        }
        return false;
      };

      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setActivas(
        all
          .filter((r) => r.estado !== "usado" && !isExpired(r) && !r.ocultaParaUsuario)
          .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0))
      );
      setUsadas(
        all
          .filter((r) => r.estado === "usado")
          .sort((a, b) => (b.validadoEn?.seconds || 0) - (a.validadoEn?.seconds || 0))
      );
    } catch (e) {
      console.log("HistorialScreen fetch error:", e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      didLoadRef.current = true;
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => fetchData({ isRefresh: true })}
      tintColor={C.green}
      colors={[C.green]}
    />
  );

  const data = activeTab === "activas" ? activas : usadas;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Mis Reservas"
        onBack={() => navigation.goBack()}
        right={<Text style={styles.sub}>{activas.length} act · {usadas.length} usadas</Text>}
      />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
            {t.key === "activas" && activas.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{activas.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name={activeTab === "activas" ? "calendar-blank-outline" : "history"}
                size={48}
                color={C.muted}
              />
              <Text style={styles.emptyText}>
                {activeTab === "activas"
                  ? "No tenés reservas activas."
                  : "Todavía no usaste ninguna reserva."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ReservaCard item={item} usada={activeTab === "usadas"} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12 },
  back:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  backText: { color: C.green, fontSize: 15 },
  title:  { color: C.text, fontSize: 26, fontWeight: "800" },
  sub:    { color: C.muted, fontSize: 13, marginTop: 2 },

  tabBar: {
    flexDirection: "row",
    marginHorizontal: 22,
    marginBottom: 8,
    backgroundColor: C.cardDark,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tabActive:     { backgroundColor: C.greenDark },
  tabText:       { color: C.muted, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: C.text },
  tabBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  tabBadgeText: { color: C.text, fontSize: 11, fontWeight: "700" },

  list: { padding: 22, gap: 10, paddingBottom: 40 },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardUsada: { borderColor: "#22c55e22", backgroundColor: "#0d1a0f" },

  cardRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#1a2a3a",
    alignItems: "center", justifyContent: "center",
  },
  iconWrapUsada: { backgroundColor: "#1a2a1a" },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" },
  cardNombre:      { color: C.text, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  cardNombreUsada: { color: C.muted },
  cardSub:  { color: C.muted, fontSize: 12 },

  badge:      { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgePase:  { backgroundColor: "#16a34a33" },
  badgeClase: { backgroundColor: "#1d4ed833" },
  badgeText:  { fontSize: 10, fontWeight: "700", color: C.green },

  validadaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#22c55e22" },
  validadaText: { color: C.green, fontSize: 12 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { color: C.muted, fontSize: 15, textAlign: "center" },
});
