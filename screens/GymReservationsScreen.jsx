import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
};

export default function GymReservationsScreen({ navigation }) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReservas = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(
          collection(db, "reservas"),
          where("gymId", "==", user.uid)
        );
        const snap = await getDocs(q);

        const data = await Promise.all(
          snap.docs.map(async (d) => {
            const reserva = { id: d.id, ...d.data() };
            // Buscar nombre del usuario
            try {
              const userSnap = await getDoc(doc(db, "usuarios", reserva.userId));
              if (userSnap.exists()) {
                const u = userSnap.data();
                reserva.nombreUsuario = `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.email || "Usuario";
              }
            } catch {
              reserva.nombreUsuario = "Usuario";
            }
            return reserva;
          })
        );

        // Más recientes primero
        data.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
        setReservas(data);
      } catch (e) {
        console.error("Error cargando reservas:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchReservas();
  }, []);

  const formatFecha = (timestamp) => {
    if (!timestamp?.seconds) return "Fecha desconocida";
    const d = new Date(timestamp.seconds * 1000);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons
          name={item.tipo === "clase" ? "account-group" : "ticket-confirmation-outline"}
          size={20}
          color={COLORS.green}
        />
        <Text style={styles.cardTipo}>
          {item.tipo === "clase" ? `Clase: ${item.nombreClase}` : "Pase libre"}
        </Text>
      </View>
      <Text style={styles.cardUsuario}>{item.nombreUsuario}</Text>
      {item.diaHora ? (
        <Text style={styles.cardDetalle}>{item.diaHora}</Text>
      ) : null}
      <Text style={styles.cardFecha}>{formatFecha(item.fecha)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reservas recibidas</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.green} style={{ marginTop: 40 }} />
      ) : reservas.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Todavía no recibiste reservas.</Text>
        </View>
      ) : (
        <FlatList
          data={reservas}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 22, paddingBottom: 12 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16, alignSelf: "flex-start" },
  backText: { color: COLORS.green, fontSize: 15 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "800" },
  list: { padding: 22, gap: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTipo: { color: COLORS.green, fontWeight: "700", fontSize: 15 },
  cardUsuario: { color: COLORS.text, fontSize: 14, marginBottom: 4 },
  cardDetalle: { color: COLORS.textMuted, fontSize: 13, marginBottom: 4 },
  cardFecha: { color: COLORS.textMuted, fontSize: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 16 },
});
