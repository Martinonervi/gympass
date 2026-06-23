import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import ScreenHeader from "../components/ScreenHeader";

const COLORS = {
  bg:        "#0f1520",
  card:      "#152030",
  green:     "#22c55e",
  border:    "#243244",
  text:      "#ffffff",
  textMuted: "#94a3b8",
  error:     "#ef4444",
};

function formatFecha(ts) {
  if (!ts?.seconds) return "";
  return new Date(ts.seconds * 1000).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function RefreshBanner() {
  return (
    <View style={{ backgroundColor: "#22c55e", flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, gap: 8 }}>
      <ActivityIndicator color="#0f1520" size="small" />
      <Text style={{ color: '#0f1520', fontSize: 13, fontWeight: '700' }}>Actualizando...</Text>
    </View>
  );
}

export default function GymReportsScreen({ navigation }) {
  const [reportes, setReportes]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReportes = async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDocs(
        query(collection(db, "reportes_gimnasios"), where("gymId", "==", user.uid))
      );
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0));
      setReportes(data);
    } catch (e) {
      console.error("Error cargando reportes:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchReportes(); }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Reportes de usuarios"
        onBack={() => navigation.goBack()}
        right={!loading ? (
          <Text style={styles.count}>{reportes.length} reporte{reportes.length !== 1 ? "s" : ""}</Text>
        ) : null}
      />
      {refreshing && <RefreshBanner />}

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.green} style={{ marginTop: 40 }} />
      ) : reportes.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="flag-off-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No hay reportes todavía.</Text>
        </View>
      ) : (
        <FlatList
          data={reportes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchReportes({ isRefresh: true })}
              tintColor={COLORS.green}
              progressBackgroundColor="#22c55e"
              colors={["#0f1520"]}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="flag-outline" size={16} color={COLORS.error} />
                <Text style={styles.cardEmail}>{item.email || "Usuario anónimo"}</Text>
              </View>
              <Text style={styles.cardMensaje}>{item.mensaje}</Text>
              {!!formatFecha(item.creadoEn) && (
                <Text style={styles.cardFecha}>{formatFecha(item.creadoEn)}</Text>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 12 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16, alignSelf: "flex-start" },
  backText: { color: COLORS.green, fontSize: 15 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "800" },
  count: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },

  list: { padding: 22, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardEmail:  { color: COLORS.text, fontSize: 13, fontWeight: "600", flex: 1 },
  cardMensaje:{ color: COLORS.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  cardFecha:  { color: COLORS.textMuted, fontSize: 11 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 16 },
});
