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
  // Colores para los planes (en minúsculas para matchear directo con tu DB)
  classic: "#38bdf8",   // Celeste
  platinum: "#a855f7",  // Púrpura
  black: "#f59e0b",     // Dorado/Ámbar
};

export default function GymStatsScreen() {
  const [loading, setLoading] = useState(true);
  const [topClases, setTopClases] = useState([]);
  const [horariosPico, setHorariosPico] = useState([]);
  const [distribucionPlanes, setDistribucionPlanes] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // 1. Traer todas las reservas de este gimnasio
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

      // =========================
      // TOP CLASES
      // =========================
      const ranking = {};
      reservas
        .filter((r) => r.tipo === "clase")
        .forEach((r) => {
          const nombre = r.actividad || "Clase";
          ranking[nombre] = (ranking[nombre] || 0) + 1;
        });

      const clasesOrdenadas = Object.entries(ranking)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

      setTopClases(clasesOrdenadas);

      // =========================
      // HORARIOS PICO
      // =========================
      const franjas = {
        "06-08": 0, "08-10": 0, "10-12": 0, "12-14": 0,
        "14-16": 0, "16-18": 0, "18-20": 0, "20-22": 0,
      };

      function obtenerFranja(hora) {
        if (hora < 8) return "06-08";
        if (hora < 10) return "08-10";
        if (hora < 12) return "10-12";
        if (hora < 14) return "12-14";
        if (hora < 16) return "14-16";
        if (hora < 18) return "16-18";
        if (hora < 20) return "18-20";
        return "20-22";
      }

      reservas
        .filter((r) => r.estado === "usado" && r.validadoEn)
        .forEach((r) => {
          const fecha = r.validadoEn.toDate();
          const hora = fecha.getHours();
          franjas[obtenerFranja(hora)]++;
        });

      setHorariosPico(Object.entries(franjas).map(([hora, cantidad]) => ({ hora, cantidad })));

      // =========================
      // DISTRIBUCIÓN POR PLAN (¡Súper Optimizado!)
      // =========================
      const reservasUsadas = reservas.filter((r) => r.estado === "usado");
      
      const conteoPlanes = { classic: 0, platinum: 0, black: 0 };
      let totalAsistencias = 0;

      reservasUsadas.forEach((r) => {
        // Leemos directo el campo nuevo planUsuario. 
        // Si es una reserva vieja, cae a "classic" por defecto para no romper nada.
        const plan = r.planUsuario ? r.planUsuario.toLowerCase() : "classic"; 
        
        if (conteoPlanes[plan] !== undefined) {
          conteoPlanes[plan]++;
          totalAsistencias++;
        }
      });

      const planesProcesados = Object.entries(conteoPlanes).map(([nombre, cantidad]) => ({
        nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
        cantidad,
        porcentaje: totalAsistencias > 0 ? Math.round((cantidad / totalAsistencias) * 100) : 0,
        color: COLORS[nombre.toLowerCase()],
      }));

      setDistribucionPlanes(planesProcesados);

    } catch (error) {
      console.error("Error exacto en fetchStats:", error);
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

  const maxAsistenciasHorario = Math.max(...horariosPico.map((h) => h.cantidad), 0);
  const tieneDatosPlanes = distribucionPlanes.some(p => p.cantidad > 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Estadísticas</Text>

        {/* DISTRIBUCIÓN POR PLAN */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Distribución por Plan</Text>
          
          {!tieneDatosPlanes ? (
            <Text style={styles.empty}>No hay datos de planes disponibles.</Text>
          ) : (
            <View>
              {/* Barra Segmentada Proporcional */}
              <View style={styles.segmentedBarContainer}>
                {distribucionPlanes.map((plan) => 
                  plan.porcentaje > 0 ? (
                    <View
                      key={plan.nombre}
                      style={[
                        styles.barSegment,
                        { width: `${plan.porcentaje}%`, backgroundColor: plan.color }
                      ]}
                    />
                  ) : null
                )}
              </View>

              {/* Leyenda con Cantidades y Porcentajes */}
              <View style={styles.legendContainer}>
                {distribucionPlanes.map((plan) => (
                  <View key={plan.nombre} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: plan.color }]} />
                    <Text style={styles.legendText}>
                      {plan.nombre}: {plan.cantidad} asist. <Text style={styles.textMuted}>({plan.porcentaje}%)</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* HORARIOS PICO */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Horarios pico</Text>
          {maxAsistenciasHorario === 0 ? (
            <Text style={styles.empty}>No hay datos suficientes.</Text>
          ) : (
            horariosPico.map((item) => {
              const porcentajeAncho = maxAsistenciasHorario > 0 ? (item.cantidad / maxAsistenciasHorario) * 100 : 0;
              return (
                <View key={item.hora} style={styles.chartRow}>
                  <Text style={styles.chartLabel}>{item.hora} hs</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.bar, { width: `${Math.max(porcentajeAncho, 2)}%` }]} />
                  </View>
                  <Text style={styles.chartCount}>{item.cantidad}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* TOP CLASES */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top de clases más populares</Text>
          {topClases.length === 0 ? (
            <Text style={styles.empty}>Todavía no hay reservas asistidas.</Text>
          ) : (
            topClases.map((clase, index) => (
              <View key={clase.nombre} style={styles.row}>
                <Text style={styles.className}>#{index + 1} {clase.nombre}</Text>
                <Text style={styles.count}>{clase.cantidad}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 22 },
  loading: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "800", marginBottom: 20 },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { color: COLORS.green, fontSize: 18, fontWeight: "700", marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  className: { color: COLORS.text, fontSize: 15 },
  count: { color: COLORS.green, fontWeight: "700", fontSize: 15 },
  empty: { color: COLORS.textMuted },
  chartRow: { flexDirection: "row", alignItems: "center", marginVertical: 6 },
  chartLabel: { color: COLORS.textMuted, fontSize: 13, width: 60 },
  barContainer: { flex: 1, height: 12, backgroundColor: "transparent", marginHorizontal: 10, justifyContent: "center" },
  bar: { height: "100%", backgroundColor: COLORS.green, borderRadius: 6 },
  chartCount: { color: COLORS.text, fontWeight: "600", fontSize: 13, width: 25, textAlign: "right" },
  
  // Estilos de la tarjeta de planes
  segmentedBarContainer: {
    flexDirection: "row",
    height: 20,
    backgroundColor: COLORS.border,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 16,
  },
  barSegment: {
    height: "100%",
  },
  legendContainer: {
    flexDirection: "column",
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
  },
});