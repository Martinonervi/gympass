import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { revisarVencimientoEmpleador } from "../utils/suscripcionEmpleador";

const C = {
  bg: "#0d1117",
  surface: "#111827",
  border: "#1e293b",
  green: "#22c55e",
  greenBg: "rgba(34,197,94,0.08)",
  greenBorder: "rgba(34,197,94,0.28)",
  amber: "#f59e0b",
  amberBg: "rgba(245,158,11,0.08)",
  amberBorder: "rgba(245,158,11,0.28)",
  text: "#f1f5f9",
  muted: "#475569",
};

export default function EmployerHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [planInfo, setPlanInfo] = useState({
    planTipo: null,
    cuposUsados: 0,
    cuposTotales: 0,
  });
  const [suscripcion, setSuscripcion] = useState({ estado: "sin-plan", vence: null });

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          const user = auth.currentUser;
          if (!user) { setLoading(false); return; }

          const empSnap = await getDoc(doc(db, "empleadores", user.uid));
          if (empSnap.exists()) {
            const data = empSnap.data();
            setNombreEmpresa(data.nombreEmpresa || "");
            setPlanInfo({
              planTipo: data.planTipo || null,
              cuposUsados: data.cuposUsados || 0,
              cuposTotales: data.cuposTotales || 0,
            });
          }

          const estadoSub = await revisarVencimientoEmpleador(user.uid);
          setSuscripcion(estadoSub);
          if (estadoSub.estado === "vencio-ahora") {
            Alert.alert(
              "Plan vencido",
              "Tu suscripción corporativa venció. Renovala desde Configurar Plan Corporativo para seguir cargando empleados."
            );
          }
        } catch (error) {
          console.log("EmployerHome fetch error:", error?.code || error?.message);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  }

  const vigente = suscripcion.estado === "vigente";
  const venceStr = suscripcion.vence
    ? suscripcion.vence.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : null;

  const { cuposUsados, cuposTotales, planTipo } = planInfo;
  const cuposLibres = Math.max(0, cuposTotales - cuposUsados);
  const barWidth = cuposTotales > 0 ? `${Math.min(100, Math.round((cuposUsados / cuposTotales) * 100))}%` : "0%";

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>PANEL DEL EMPLEADOR</Text>
      <Text style={styles.companyName}>
        {nombreEmpresa || "Tu empresa"}
      </Text>

      <View style={[styles.pill, vigente ? styles.pillGreen : styles.pillAmber]}>
        <View style={[styles.pillDot, { backgroundColor: vigente ? C.green : C.amber }]} />
        <Text style={[styles.pillText, { color: vigente ? C.green : C.amber }]}>
          {vigente
            ? `Plan activo${venceStr ? ` · vence ${venceStr}` : ""}`
            : suscripcion.estado === "vencio-ahora"
            ? "Plan vencido · Renovalo para continuar"
            : "Sin plan activo · Configurá tu plan"}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Empleados</Text>
          <Text style={styles.statValue}>{cuposUsados}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Cupos totales</Text>
          <Text style={[styles.statValue, { color: C.text }]}>{cuposTotales || "—"}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Plan</Text>
          <Text style={[styles.statValue, { fontSize: 14, marginTop: 4 }]}>
            {planTipo || "—"}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionCard, styles.actionCardGreen]}
        onPress={() => navigation.navigate("EmployerPlanConfig")}
        activeOpacity={0.8}
      >
        <View style={styles.actionCardHeader}>
          <View style={[styles.actionIcon, styles.actionIconGreen]}>
            <Ionicons name="ribbon-outline" size={22} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Plan Corporativo</Text>
            <Text style={styles.actionSub}>Configurar y renovar</Text>
          </View>
        </View>

        <View style={styles.barRow}>
          <Text style={styles.barLabel}>Cupos</Text>
          <Text style={styles.barLabel}>{cuposUsados} / {cuposTotales || "—"} usados</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: barWidth }]} />
        </View>

        <View style={styles.actionBtn}>
          <Text style={styles.actionBtnTextGreen}>Configurar plan</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate("EmployerManageEmployees")}
        activeOpacity={0.8}
      >
        <View style={styles.actionCardHeader}>
          <View style={styles.actionIcon}>
            <Ionicons name="people-outline" size={22} color={C.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Nómina</Text>
            <Text style={styles.actionSub}>Agregar y gestionar empleados</Text>
          </View>
        </View>

        <View style={styles.nominaStats}>
          <View style={styles.nominaStatItem}>
            <Text style={styles.statLabel}>Activos</Text>
            <Text style={[styles.statValue, { fontSize: 20 }]}>{cuposUsados}</Text>
          </View>
          <View style={styles.nominaStatItem}>
            <Text style={styles.statLabel}>Cupos libres</Text>
            <Text style={[styles.statValue, { fontSize: 20, color: C.text }]}>{cuposLibres}</Text>
          </View>
        </View>

        <View style={[styles.actionBtn, styles.actionBtnNeutral]}>
          <Text style={styles.actionBtnTextNeutral}>Administrar nómina</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
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
  companyName: {
    color: C.text,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: 20,
    borderWidth: 0.5,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  pillGreen: {
    backgroundColor: C.greenBg,
    borderColor: C.greenBorder,
  },
  pillAmber: {
    backgroundColor: C.amberBg,
    borderColor: C.amberBorder,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
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
    marginBottom: 3,
  },
  statValue: {
    color: C.green,
    fontSize: 22,
    fontWeight: "700",
  },
  actionCard: {
    backgroundColor: C.surface,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  actionCardGreen: {
    backgroundColor: "rgba(34,197,94,0.06)",
    borderColor: C.greenBorder,
  },
  actionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconGreen: {
    backgroundColor: "rgba(34,197,94,0.15)",
  },
  actionTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 1,
  },
  actionSub: {
    color: C.muted,
    fontSize: 11,
  },
  barRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  barLabel: {
    color: C.muted,
    fontSize: 11,
  },
  barTrack: {
    backgroundColor: C.border,
    borderRadius: 4,
    height: 5,
    marginBottom: 14,
    overflow: "hidden",
  },
  barFill: {
    backgroundColor: C.green,
    height: "100%",
    borderRadius: 4,
  },
  nominaStats: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  nominaStatItem: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 10,
  },
  actionBtn: {
    backgroundColor: C.green,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnGreen: {
    backgroundColor: C.green,
  },
  actionBtnNeutral: {
    backgroundColor: C.border,
  },
  actionBtnTextGreen: {
    color: C.bg,
    fontSize: 13,
    fontWeight: "600",
  },
  actionBtnTextNeutral: {
    color: C.text,
    fontSize: 13,
    fontWeight: "600",
  },
});
