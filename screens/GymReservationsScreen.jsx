import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  cardDark: "#0d1824",
  green: "#22c55e",
  greenDark: "#16a34a",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
};

const TABS = [
  { key: "todos",  label: "Todos" },
  { key: "pases",  label: "Pases" },
  { key: "clases", label: "Clases" },
];

function formatFecha(timestamp) {
  if (!timestamp?.seconds) return "";
  return new Date(timestamp.seconds * 1000).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function groupByClase(reservas) {
  const map = {};
  for (const r of reservas) {
    // Group by claseId + claseFecha so each weekly occurrence is a separate group
    const key = r.claseFecha
      ? `${r.claseId || r.nombreClase || "sin-clase"}__${r.claseFecha}`
      : r.claseId || r.nombreClase || "sin-clase";
    if (!map[key]) {
      map[key] = {
        key,
        nombreClase: r.actividad || r.nombreClase || "Clase",
        diaHora: r.diaHora || "",
        claseFecha: r.claseFecha || null,
        claseFechaDisplay: r.claseFechaDisplay || null,
        reservas: [],
      };
    }
    map[key].reservas.push(r);
  }
  // Sort: first by date (claseFecha ascending), then by class name
  return Object.values(map).sort((a, b) => {
    if (a.claseFecha && b.claseFecha) {
      if (a.claseFecha !== b.claseFecha) return a.claseFecha < b.claseFecha ? -1 : 1;
    } else if (a.claseFecha) return -1;
    else if (b.claseFecha) return 1;
    return a.nombreClase.localeCompare(b.nombreClase);
  });
}

function TabBar({ active, onChange }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.tab, active === t.key && styles.tabActive]}
          onPress={() => onChange(t.key)}
        >
          <Text style={[styles.tabText, active === t.key && styles.tabTextActive]}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PaseCard({ item }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="ticket-confirmation-outline" size={18} color={COLORS.green} />
        <Text style={styles.cardTipo}>Pase libre</Text>
        <Text style={styles.cardCode}>#{item.id.slice(-6).toUpperCase()}</Text>
      </View>
      <Text style={styles.cardUsuario}>{item.emailUsuario || item.nombreUsuario || "Usuario"}</Text>
      {formatFecha(item.fecha) ? (
        <Text style={styles.cardFecha}>{formatFecha(item.fecha)}</Text>
      ) : null}
    </View>
  );
}

function ClaseGroup({ group }) {
  // Build subtitle: show specific date if available, otherwise fall back to diaHora
  const subtitulo = group.claseFechaDisplay || group.diaHora || null;

  return (
    <View style={styles.claseGroup}>
      <View style={styles.claseGroupHeader}>
        <MaterialCommunityIcons name="account-group" size={18} color={COLORS.green} />
        <View style={{ flex: 1 }}>
          <Text style={styles.claseGroupNombre}>{group.nombreClase}</Text>
          {!!subtitulo && (
            <Text style={styles.claseGroupHorario}>{subtitulo}</Text>
          )}
        </View>
        <View style={styles.claseGroupBadge}>
          <Text style={styles.claseGroupBadgeText}>{group.reservas.length}</Text>
        </View>
      </View>
      {group.reservas.map((r) => (
        <View key={r.id} style={styles.claseUserRow}>
          <MaterialCommunityIcons name="account-outline" size={15} color={COLORS.textMuted} />
          <Text style={styles.claseUserNombre}>{r.emailUsuario || r.nombreUsuario || "Usuario"}</Text>
        </View>
      ))}
    </View>
  );
}

function RefreshBanner() {
  return (
    <View style={{ backgroundColor: "#22c55e", flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, gap: 8 }}>
      <ActivityIndicator color="#0f1520" size="small" />
      <Text style={{ color: '#0f1520', fontSize: 13, fontWeight: '700' }}>Actualizando...</Text>
    </View>
  );
}

export default function GymReservationsScreen({ navigation }) {
  const [reservas, setReservas]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("todos");

  const fetchReservas = async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDocs(
        query(collection(db, "reservas"), where("gymId", "==", user.uid))
      );

      const now = new Date();
      const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
      const todayStr = now.toISOString().slice(0, 10);

      const isExpired = (r) => {
        if (r.tipo === "pase") {
          if (!r.fecha?.seconds) return false;
          return new Date(r.fecha.seconds * 1000) < todayMidnight;
        }
        if (r.tipo === "clase") {
          if (!r.claseFecha) return false;
          if (r.claseFecha < todayStr) return true;
          if (r.claseFecha === todayStr && r.horaFin) {
            const [h, m] = r.horaFin.split(":").map(Number);
            const [y, mo, d] = todayStr.split("-").map(Number);
            return new Date(y, mo - 1, d, h, m, 0, 0) <= now;
          }
          return false;
        }
        return false;
      };

      const data = snap.docs
        .filter((d) => !isExpired(d.data()))
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
      setReservas(data);
    } catch (e) {
      console.error("Error cargando reservas:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchReservas(); }, []);

  const pases  = reservas.filter((r) => r.tipo === "pase");
  const clases = reservas.filter((r) => r.tipo === "clase");

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => fetchReservas({ isRefresh: true })}
      tintColor={COLORS.green}
      colors={[COLORS.green]}
    />
  );

  const renderTodos = () => (
    <FlatList
      data={reservas}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyState />}
      refreshControl={refreshControl}
      renderItem={({ item }) =>
        item.tipo === "clase" ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="account-group" size={18} color={COLORS.green} />
              <Text style={styles.cardTipo}>Clase: {item.actividad || item.nombreClase || "Clase"}</Text>
            </View>
            <Text style={styles.cardUsuario}>{item.emailUsuario || item.nombreUsuario || "Usuario"}</Text>
            {!!item.diaHora && <Text style={styles.cardDetalle}>{item.diaHora}</Text>}
            {formatFecha(item.fecha) ? <Text style={styles.cardFecha}>{formatFecha(item.fecha)}</Text> : null}
          </View>
        ) : (
          <PaseCard item={item} />
        )
      }
    />
  );

  const renderPases = () => (
    <FlatList
      data={pases}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyState mensaje="No hay pases reservados." />}
      refreshControl={refreshControl}
      renderItem={({ item }) => <PaseCard item={item} />}
    />
  );

  const renderClases = () => {
    const grupos = groupByClase(clases);
    if (grupos.length === 0) return (
      <ScrollView contentContainerStyle={styles.list} refreshControl={refreshControl}>
        <EmptyState mensaje="No hay reservas de clases." />
      </ScrollView>
    );
    return (
      <ScrollView contentContainerStyle={styles.list} refreshControl={refreshControl}>
        {grupos.map((g) => <ClaseGroup key={g.key} group={g} />)}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reservas recibidas</Text>
        <View style={styles.countRow}>
          <Text style={styles.countText}>{pases.length} pases · {clases.length} clases</Text>
        </View>
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} />
      {refreshing && <RefreshBanner />}

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.green} style={{ marginTop: 40 }} />
      ) : activeTab === "todos" ? renderTodos()
        : activeTab === "pases" ? renderPases()
        : renderClases()
      }
    </SafeAreaView>
  );
}

function EmptyState({ mensaje = "Todavía no recibiste reservas." }) {
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={COLORS.textMuted} />
      <Text style={styles.emptyText}>{mensaje}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 12 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16, alignSelf: "flex-start" },
  backText: { color: COLORS.green, fontSize: 15 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "800" },
  countRow: { marginTop: 4 },
  countText: { color: COLORS.textMuted, fontSize: 13 },

  tabBar: {
    flexDirection: "row",
    marginHorizontal: 22,
    marginBottom: 8,
    backgroundColor: COLORS.cardDark,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  tabActive: { backgroundColor: COLORS.greenDark },
  tabText: { color: COLORS.textMuted, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: COLORS.text },

  list: { padding: 22, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTipo: { color: COLORS.green, fontWeight: "700", fontSize: 15, flex: 1 },
  cardCode: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  cardUsuario: { color: COLORS.text, fontSize: 14, marginBottom: 4 },
  cardDetalle: { color: COLORS.textMuted, fontSize: 13, marginBottom: 4 },
  cardFecha: { color: COLORS.textMuted, fontSize: 12 },

  claseGroup: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  claseGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardDark,
  },
  claseGroupNombre: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  claseGroupHorario: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  claseGroupBadge: {
    backgroundColor: COLORS.greenDark,
    borderRadius: 20,
    minWidth: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  claseGroupBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  claseUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  claseUserNombre: { color: COLORS.text, fontSize: 14, flex: 1 },
  claseUserFecha: { color: COLORS.textMuted, fontSize: 11 },
  claseUserCode: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 16 },
});
