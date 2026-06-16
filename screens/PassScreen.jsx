import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import * as WebBrowser from "expo-web-browser";
import { auth, db } from "../firebaseConfig";

const BACKEND_URL = "https://gympass-production.up.railway.app";

// ─── Plan constants ───────────────────────────────────────────────────────────
const PLANES = [
  {
    id: "classic",
    nombre: "Classic",
    precio: 5000,
    color: "#64748b",
    beneficios: [
      "Acceso a gimnasios Classic",
      "1 pase por día por gimnasio",
    ],
  },
  {
    id: "platinum",
    nombre: "Platinum",
    precio: 10000,
    color: "#8b5cf6",
    beneficios: [
      "Acceso a gimnasios Classic y Platinum",
      "1 pase por día por gimnasio",
      "Reserva de clases grupales",
    ],
  },
  {
    id: "black",
    nombre: "Black",
    precio: 20000,
    color: "#f59e0b",
    beneficios: [
      "Acceso a todos los gimnasios",
      "Múltiples pases por día",
      "Reserva de clases grupales",
    ],
  },
];

// ─── Snackbar ─────────────────────────────────────────────────────────────────
function Snackbar({ message, type = "error", visible }) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 100, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const isSuccess = type === "success";
  return (
    <Animated.View
      style={[styles.snackbar, isSuccess ? styles.snackbarSuccess : styles.snackbarError,
      { transform: [{ translateY }], opacity }]}
      pointerEvents="none"
    >
      <Text style={styles.snackbarIcon}>{isSuccess ? "✓" : "✕"}</Text>
      <Text style={styles.snackbarText}>{message}</Text>
    </Animated.View>
  );
}

function useSnackbar() {
  const [snackbar, setSnackbar] = useState({ visible: false, message: "", type: "error" });
  const timerRef = useRef(null);
  function showSnackbar(message, type = "error", duration = 3500) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSnackbar({ visible: true, message, type });
    timerRef.current = setTimeout(() => setSnackbar((p) => ({ ...p, visible: false })), duration);
  }
  return { snackbar, showSnackbar };
}

function RefreshBanner() {
  return (
    <View style={{ backgroundColor: COLORS.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, gap: 8 }}>
      <ActivityIndicator color="#0f1520" size="small" />
      <Text style={{ color: '#0f1520', fontSize: 13, fontWeight: '700' }}>Actualizando...</Text>
    </View>
  );
}

// ─── PassScreen ───────────────────────────────────────────────────────────────
export default function PassScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [planActivo, setPlanActivo] = useState(null);
  const { snackbar, showSnackbar } = useSnackbar();

  const fetchPlan = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    try {
      const snap = await getDoc(doc(db, "usuarios", user.uid));
      if (snap.exists()) {
        const planGuardado = snap.data().plan;
        setPlanActivo(planGuardado ? planGuardado.toLowerCase() : null);
      };
    } catch (error) {
      console.log("PassScreen fetchPlan error:", error?.code || error?.message || error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPlan();
    }, [fetchPlan])
  );

  async function selectPlan(planId) {
    if (planId === planActivo) return;
    const user = auth.currentUser;
    if (!user || saving) return;
    setSaving(true);
    try {
      const idToken = await user.getIdToken();

      const response = await fetch(`${BACKEND_URL}/crear-preferencia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al crear preferencia");

      // Abrimos el checkout y esperamos a que MercadoPago redirija de vuelta
      // a la app mediante el deep link (back_urls). El segundo argumento es el
      // scheme de retorno: cuando MP redirige a gympass://payment?status=...,
      // openAuthSessionAsync se resuelve con { type: "success", url }.
      const result = await WebBrowser.openAuthSessionAsync(
        data.initPoint,
        "gympass://payment"
      );

      // Si el usuario cierra el navegador sin completar el pago, el tipo es
      // "cancel" o "dismiss" y NO se acredita ningún cambio de plan.
      if (result.type !== "success" || !result.url) {
        showSnackbar("Pago cancelado. No se realizó ningún cambio.", "error");
        return;
      }

      // Parseamos el status que viene en la URL de retorno (back_url).
      const returnedStatus = result.url.match(/[?&]status=([^&]+)/)?.[1];

      if (returnedStatus === "approved") {
        // Pago confirmado → acreditamos el plan en Firestore.
        await setDoc(
          doc(db, "usuarios", user.uid),
          { plan: planId, planActualizadoEn: serverTimestamp() },
          { merge: true }
        );
        setPlanActivo(planId);
        const plan = PLANES.find((p) => p.id === planId);
        showSnackbar(`Plan ${plan?.nombre || ""} activado.`, "success");
      } else if (returnedStatus === "pending") {
        showSnackbar("El pago quedó pendiente de acreditación.", "error");
      } else {
        showSnackbar("El pago fue rechazado. No se acreditó el plan.", "error");
      }
    } catch (error) {
      console.log("PassScreen selectPlan error:", error?.code || error?.message || error);
      showSnackbar("No se pudo iniciar el pago. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  function confirmCancel() {
    Alert.alert(
      "Dar de baja",
      "¿Seguro que querés dar de baja tu plan? Perderás acceso a los gimnasios.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, dar de baja", style: "destructive", onPress: cancelPlan },
      ]
    );
  }

  async function cancelPlan() {
    const user = auth.currentUser;
    if (!user || saving) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "usuarios", user.uid),
        { plan: null, planActualizadoEn: serverTimestamp() },
        { merge: true }
      );
      setPlanActivo(null);
      showSnackbar("Tu plan fue dado de baja.", "success");
    } catch (error) {
      console.log("PassScreen cancelPlan error:", error?.code || error?.message || error);
      showSnackbar("No se pudo dar de baja el plan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.green} />
        </View>
      </SafeAreaView>
    );
  }

  const planActivoData = PLANES.find((p) => p.id === planActivo);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      {refreshing && <RefreshBanner />}
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await fetchPlan(); setRefreshing(false); }}
            tintColor={COLORS.green}
            colors={[COLORS.green]}
          />
        }
      >
        <Text style={styles.title}>Mi Pase</Text>

        {/* ── Active plan card ── */}
        {planActivoData ? (
          <View style={[styles.activeCard, { borderColor: planActivoData.color }]}>
            <Text style={styles.activeLabel}>PLAN ACTIVO</Text>
            <Text style={[styles.activeName, { color: planActivoData.color }]}>
              {planActivoData.nombre}
            </Text>
            {planActivoData.beneficios.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <MaterialCommunityIcons name="check-circle-outline" size={14} color={COLORS.green} />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={confirmCancel}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Dar de baja mi plan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeCard}>
            <Text style={styles.activeLabel}>SIN PLAN ACTIVO</Text>
            <Text style={styles.activeDesc}>Elegí un plan abajo para activar tu pase.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Planes disponibles</Text>

        {/* ── Plan cards ── */}
        {PLANES.map((plan) => {
          const isActive = plan.id === planActivo;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, isActive && { borderColor: plan.color, borderWidth: 2 }]}
              onPress={() => selectPlan(plan.id)}
              disabled={saving}
              activeOpacity={0.8}
            >
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: plan.color }]}>{plan.nombre}</Text>
                {isActive && (
                  <MaterialCommunityIcons name="check-circle" size={22} color={plan.color} />
                )}
              </View>
              <Text style={styles.planPrecio}>${plan.precio.toLocaleString("es-AR")}/mes</Text>

              {plan.beneficios.map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <MaterialCommunityIcons
                    name="check"
                    size={13}
                    color={isActive ? plan.color : COLORS.border}
                  />
                  <Text style={[styles.benefitText, isActive && { color: COLORS.text }]}>{b}</Text>
                </View>
              ))}

              <View style={[styles.planAction, isActive && { backgroundColor: "transparent", borderColor: plan.color }]}>
                <Text style={[styles.planActionText, isActive && { color: plan.color }]}>
                  {isActive ? "Plan activo" : "Elegir plan"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Snackbar message={snackbar.message} type={snackbar.type} visible={snackbar.visible} />
    </SafeAreaView>
  );
}

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  greenDark: "#16a34a",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  error: "#ef4444",
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 22, paddingBottom: 40 },

  title: { color: COLORS.text, fontSize: 28, fontWeight: "800", marginBottom: 16 },

  activeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 22,
  },
  activeLabel: { color: COLORS.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  activeName: { fontSize: 26, fontWeight: "800", marginBottom: 10 },
  activeDesc: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },

  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  benefitText: { color: COLORS.textMuted, fontSize: 13, flex: 1 },

  cancelButton: {
    borderWidth: 1, borderColor: COLORS.error,
    borderRadius: 12, paddingVertical: 11,
    alignItems: "center", marginTop: 14,
  },
  cancelButtonText: { color: COLORS.error, fontSize: 14, fontWeight: "700" },

  sectionTitle: { color: COLORS.green, fontSize: 15, fontWeight: "700", marginBottom: 10 },

  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  planName: { fontSize: 20, fontWeight: "800" },
  planPrecio: { color: COLORS.textMuted, fontSize: 13, marginBottom: 10 },
  planAction: {
    backgroundColor: COLORS.greenDark,
    borderRadius: 12, paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1, borderColor: "transparent",
    marginTop: 14,
  },
  planActionText: { color: COLORS.text, fontSize: 14, fontWeight: "700" },

  snackbar: {
    position: "absolute", bottom: 30, left: 20, right: 20,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  snackbarError: { backgroundColor: "#1f0a0a", borderWidth: 1, borderColor: COLORS.error },
  snackbarSuccess: { backgroundColor: "#0a1f0e", borderWidth: 1, borderColor: COLORS.green },
  snackbarIcon: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  snackbarText: { color: COLORS.text, fontSize: 14, flex: 1, lineHeight: 20 },
});
