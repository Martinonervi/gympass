import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  border: "#243244",
  green: "#22c55e",
  text: "#ffffff",
  textMuted: "#94a3b8",
};

export default function GymStatsScreen() {
  const [loading, setLoading] = useState(true);
  const [topClases, setTopClases] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const snap = await getDocs(
        query(
          collection(db, "reservas"),
          where("gymId", "==", user.uid)
        )
      );

      const reservas = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const ranking = {};

      reservas
        .filter((r) => r.tipo === "clase")
        .forEach((r) => {
          const nombre = r.actividad || "Clase";
          ranking[nombre] = (ranking[nombre] || 0) + 1;
        });

      const ordenadas = Object.entries(ranking)
        .map(([nombre, cantidad]) => ({
          nombre,
          cantidad,
        }))
        .sort((a, b) => b.cantidad - a.cantidad);

      setTopClases(ordenadas);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Estadísticas</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Top de clases más populares
          </Text>

          {topClases.length === 0 ? (
            <Text style={styles.empty}>
              Todavía no hay reservas de clases.
            </Text>
          ) : (
            topClases.map((clase, index) => (
              <View key={clase.nombre} style={styles.row}>
                <Text style={styles.className}>
                  #{index + 1} {clase.nombre}
                </Text>

                <Text style={styles.count}>
                  {clase.cantidad}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  content: {
    padding: 22,
  },

  loading: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 20,
  },

  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
  },

  cardTitle: {
    color: COLORS.green,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  className: {
    color: COLORS.text,
    fontSize: 15,
  },

  count: {
    color: COLORS.green,
    fontWeight: "700",
    fontSize: 15,
  },

  empty: {
    color: COLORS.textMuted,
  },
});