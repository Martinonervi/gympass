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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  greenDark: "#16a34a",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  input: "#111827",
  error: "#ef4444",
};

// ─── Planes hardcoded ────────────────────────────────────────────────────────
// Si más adelante querés que sean editables sin tocar código, los movés a
// una colección /planes en Firestore y los leés desde acá.
const PLANES = [
  {
    id: "classic",
    nombre: "Classic",
    descripcion: "Acceso a gimnasios básicos.",
    accent: "#ffffff",
  },
  {
    id: "platinum",
    nombre: "Platinum",
    descripcion: "Acceso a gimnasios premium y clases grupales.",
    accent: "#ffffff",
  },
  {
    id: "black",
    nombre: "Black",
    descripcion: "Acceso ilimitado a toda la red, incluyendo spa y nutrición.",
    accent: "#ffffff",
  },
];

// ─── Snackbar ────────────────────────────────────────────────────────────────
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
      style={[
        styles.snackbar,
        isSuccess ? styles.snackbarSuccess : styles.snackbarError,
        { transform: [{ translateY }], opacity },
      ]}
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

  function showSnackbar(message, type = "error", duration = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSnackbar({ visible: true, message, type });
    timerRef.current = setTimeout(() => setSnackbar((p) => ({ ...p, visible: false })), duration);
  }

  return { snackbar, showSnackbar };
}

// ─── PassScreen ──────────────────────────────────────────────────────────────
export default function PassScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planActivo, setPlanActivo] = useState(null);
  const { snackbar, showSnackbar } = useSnackbar();

  const fetchPlan = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const snap = await getDoc(doc(db, "usuarios", user.uid));
      if (snap.exists()) {
        setPlanActivo(snap.data().plan || null);
      }
    } catch (error) {
      console.log("PassScreen: no se pudo leer plan", error?.code || error?.message || error);
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

  function confirmCancel() {
    Alert.alert(
      "Dar de baja",
      "¿Seguro que querés dar de baja tu plan? Vas a quedar sin pase activo.",
      [
        { text: "No", style: "cancel" },
        { text: "Sí, dar de baja", style: "destructive", onPress: cancelPlan },
      ]
    );
  }

  async function cancelPlan() {
    const user = auth.currentUser;
    if (!user) return;
    if (saving) return;

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
      console.log("PassScreen cancel error:", error?.code || error?.message || error);
      showSnackbar("No se pudo dar de baja el plan.");
    } finally {
      setSaving(false);
    }
  }

  async function selectPlan(planId) {
    if (planId === planActivo) return; 
    const user = auth.currentUser;
    if (!user) return;
    if (saving) return;

    setSaving(true);
    try {
      await setDoc(
        doc(db, "usuarios", user.uid),
        { plan: planId, planActualizadoEn: serverTimestamp() },
        { merge: true }
      );
      setPlanActivo(planId);
      const plan = PLANES.find((p) => p.id === planId);
      showSnackbar(`Tu plan ${plan?.nombre || ""} fue activado.`, "success");
    } catch (error) {
      console.log("PassScreen save error:", error?.code || error?.message || error);
      showSnackbar("No se pudo actualizar tu plan.");
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

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Mi Pase</Text>

        {planActivoData ? (
          <View style={[styles.activeCard, { borderColor: planActivoData.accent }]}>
            <Text style={styles.activeLabel}>PLAN ACTIVO</Text>
            <Text style={[styles.activeName, { color: planActivoData.accent }]}>
              {planActivoData.nombre}
            </Text>
            <Text style={styles.activeDesc}>{planActivoData.descripcion}</Text>

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
            <Text style={styles.activeDesc}>
              Elegí un plan abajo para activar tu pase.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Planes disponibles</Text>

        {PLANES.map((plan) => {
          const isActive = plan.id === planActivo;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                isActive && { borderColor: plan.accent, borderWidth: 2, backgroundColor: COLORS.greenDark},
              ]}
              onPress={() => selectPlan(plan.id)}
              disabled={saving}
              activeOpacity={0.8}
            >
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: plan.accent }]}>
                  {plan.nombre}
                </Text>
                {isActive && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={22}
                    color={plan.accent}
                  />
                )}
              </View>
              <Text style={[styles.planDesc, isActive && { color: '#ffffff' }]}>
                {plan.descripcion}
              </Text>
              <View
                style={[
                  styles.planAction,
                  isActive && { backgroundColor: "transparent", borderColor: plan.accent },
                ]}
              >
                <Text
                  style={[
                    styles.planActionText,
                    isActive && { color: plan.accent },
                  ]}
                >
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 22, paddingBottom: 40 },

  title: { color: COLORS.text, fontSize: 28, fontWeight: "800", marginBottom: 16 },

  activeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 22,
  },
  activeLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 6,
  },
  activeName: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  activeDesc: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  cancelButton: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 14,
  },
  cancelButtonText: { color: COLORS.error, fontSize: 14, fontWeight: "700" },

  sectionTitle: {
    color: COLORS.green,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },

  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  planName: { fontSize: 20, fontWeight: "800" },
  planDesc: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  planAction: {
    backgroundColor: COLORS.greenDark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  planActionText: { color: COLORS.text, fontSize: 14, fontWeight: "700" },

  snackbar: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  snackbarError: { backgroundColor: "#1f0a0a", borderWidth: 1, borderColor: COLORS.error },
  snackbarSuccess: { backgroundColor: "#0a1f0e", borderWidth: 1, borderColor: COLORS.green },
  snackbarIcon: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  snackbarText: { color: COLORS.text, fontSize: 14, flex: 1, lineHeight: 20 },
});
