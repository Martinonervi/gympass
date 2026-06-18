import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { auth, db } from "../firebaseConfig";

const C = {
  bg: "#0d1117",
  surface: "#111827",
  surfaceAlt: "#16a34a18",
  border: "#1e293b",
  borderGreen: "#16a34a44",
  green: "#22c55e",
  amber: "#f59e0b",
  text: "#f1f5f9",
  muted: "#475569",
};

const ACTION_CARDS = [
  { label: "Detalles", sub: "Fotos e info", icon: "image-outline", screen: "ManageGymDetails", accent: false },
  { label: "Clases", sub: "Gestionar horarios", icon: "calendar-outline", screen: "ManageClasses", accent: false },
  { label: "Reservas", sub: "Ver recibidas", icon: "list-outline", screen: "GymReservations", accent: false },
  { label: "Estadísticas", sub: "Métricas del gym", icon: "bar-chart-outline", screen: "GymStats", accent: false },
  { label: "Reportes", sub: "De usuarios", icon: "flag-outline", screen: "GymReports", amber: true },
  { label: "Reseñas", sub: "Ver opiniones", icon: "star-outline", screen: "GymReviews", amber: true },
  { label: "Validar QR", sub: "Escanear pase", icon: "qr-code-outline", screen: "QRScanner", accent: true },
  { label: "Código", sub: "Validar acceso", icon: "key-outline", screen: "CodeValidator", accent: true },
];

export default function GymOwnerHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [nombreGimnasio, setNombreGimnasio] = useState("");
  const [stats, setStats] = useState({ reservasHoy: null, clasesActivas: null, reseñaPromedio: null, saldoPendiente: null });

  useFocusEffect(useCallback(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const [gymSnap, clasesSnap, resenasSnap, reservasSnap] = await Promise.all([
          getDoc(doc(db, "gimnasios", user.uid)),
          getDocs(collection(db, "gimnasios", user.uid, "clases")),
          getDocs(collection(db, "gimnasios", user.uid, "resenas")),
          getDocs(query(collection(db, "reservas"), where("gymId", "==", user.uid))),
        ]);

        if (gymSnap.exists()) {
          const gymData = gymSnap.data();
          setNombreGimnasio(gymData.nombreGimnasio || "");
          setStats((prev) => ({ ...prev, saldoPendiente: gymData.saldoPendiente ?? 0 }));
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        let reservasHoy = 0;
        reservasSnap.forEach((d) => {
          const secs = d.data().fecha?.seconds;
          if (!secs) return;
          const ts = secs * 1000;
          if (ts >= todayStart.getTime() && ts <= todayEnd.getTime()) reservasHoy++;
        });

        let totalStars = 0;
        let countStars = 0;
        resenasSnap.forEach((d) => {
          const r = d.data().rating;
          if (typeof r === "number") { totalStars += r; countStars++; }
        });
        const reseñaPromedio = countStars > 0 ? (totalStars / countStars).toFixed(1) : null;

        setStats((prev) => ({
          ...prev,
          reservasHoy,
          clasesActivas: clasesSnap.size,
          reseñaPromedio,
        }));
      } catch (err) {
        console.log("GymOwnerHome fetch error:", err?.code || err?.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [])));

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>PANEL DEL GIMNASIO</Text>
      {nombreGimnasio ? (
        <Text style={styles.gymName}>{nombreGimnasio}</Text>
      ) : (
        <Text style={styles.gymName}>Tu gimnasio</Text>
      )}
      <Text style={styles.subtitle}>
        {nombreGimnasio ? "Bienvenido de nuevo" : "Completá tu información desde Perfil"}
      </Text>

      <View style={styles.statsRow}>
        <StatCard label="Reservas hoy" value={stats.reservasHoy} />
        <StatCard label="Clases activas" value={stats.clasesActivas} />
        <StatCard
          label="Reseña prom."
          value={stats.reseñaPromedio !== null ? stats.reseñaPromedio : "—"}
        />
      </View>

      <View style={styles.saldoCard}>
        <Text style={styles.saldoLabel}>SALDO PENDIENTE DE COBRO</Text>
        <Text style={styles.saldoValue}>
          ${(stats.saldoPendiente ?? 0).toLocaleString("es-AR")}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>ACCIONES RÁPIDAS</Text>

      <View style={styles.grid}>
        {ACTION_CARDS.map((card) => (
          <TouchableOpacity
            key={card.screen}
            style={[
              styles.card,
              card.accent && styles.cardAccent,
            ]}
            onPress={() => navigation.navigate(card.screen)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={card.icon}
              size={24}
              color={card.amber ? C.amber : C.green}
            />
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardSub}>{card.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value !== null && value !== undefined ? value : "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    padding: 20,
    paddingBottom: 32,
  },
  eyebrow: {
    color: C.muted,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 4,
    marginTop: 8,
  },
  gymName: {
    color: C.green,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 2,
  },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
  },
  statLabel: {
    color: C.muted,
    fontSize: 10,
    marginBottom: 4,
  },
  statValue: {
    color: C.green,
    fontSize: 22,
    fontWeight: "700",
  },
  saldoCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: "rgba(34,197,94,0.3)",
    backgroundColor: "rgba(34,197,94,0.06)",
  },
  saldoLabel: {
    color: C.muted,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  saldoValue: {
    color: C.green,
    fontSize: 28,
    fontWeight: "700",
  },
  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: "47.5%",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  cardAccent: {
    backgroundColor: C.surfaceAlt,
    borderColor: C.borderGreen,
  },
  cardLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 2,
  },
  cardSub: {
    color: C.muted,
    fontSize: 11,
  },
});
