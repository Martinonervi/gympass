import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
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

  function showSnackbar(message, type = "error", duration = 3500) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSnackbar({ visible: true, message, type });
    timerRef.current = setTimeout(() => setSnackbar((p) => ({ ...p, visible: false })), duration);
  }

  return { snackbar, showSnackbar };
}

// ─── AddClassScreen ──────────────────────────────────────────────────────────
export default function AddClassScreen({ navigation }) {
  const [saving, setSaving] = useState(false);
  const { snackbar, showSnackbar } = useSnackbar();

  const [nombre, setNombre] = useState("");
  const [diaHora, setDiaHora] = useState("");
  const [duracion, setDuracion] = useState("");
  const [cupo, setCupo] = useState("");
  const [profesor, setProfesor] = useState("");
  const [descripcion, setDescripcion] = useState("");

  async function handleSave() {
    const user = auth.currentUser;
    if (!user) {
      showSnackbar("No hay un usuario autenticado.");
      return;
    }

    const cleanNombre = nombre.trim();
    const cleanDiaHora = diaHora.trim();
    const cleanDuracion = duracion.trim();

    if (!cleanNombre || !cleanDiaHora || !cleanDuracion) {
      showSnackbar("Nombre, día/hora y duración son obligatorios.");
      return;
    }

    const duracionNum = parseInt(cleanDuracion, 10);
    if (isNaN(duracionNum) || duracionNum <= 0) {
      showSnackbar("La duración debe ser un número positivo (minutos).");
      return;
    }

    const cupoNum = cupo.trim() ? parseInt(cupo.trim(), 10) : null;
    if (cupo.trim() && (isNaN(cupoNum) || cupoNum <= 0)) {
      showSnackbar("El cupo debe ser un número positivo.");
      return;
    }

    setSaving(true);
    try {
      const clasesRef = collection(db, "gimnasios", user.uid, "clases");
      await addDoc(clasesRef, {
        nombre: cleanNombre,
        diaHora: cleanDiaHora,
        duracion: duracionNum,
        cupo: cupoNum,
        profesor: profesor.trim(),
        descripcion: descripcion.trim(),
        creadoEn: serverTimestamp(),
      });

      showSnackbar("Clase agregada.", "success");
      setTimeout(() => navigation.goBack(), 800);
    } catch (error) {
      console.log("AddClass error:", error?.code || error?.message || error);
      let message = "No se pudo agregar la clase.";
      if (error?.code === "permission-denied") {
        message = "No tenés permisos para guardar. Revisá las reglas de Firestore.";
      }
      showSnackbar(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.back}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Agregar clase</Text>
        <Text style={styles.subtitle}>Cargá los datos de la nueva clase.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Yoga"
            placeholderTextColor={COLORS.textMuted}
            value={nombre}
            onChangeText={setNombre}
          />

          <Text style={styles.label}>Día y hora *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Lunes 10:00"
            placeholderTextColor={COLORS.textMuted}
            value={diaHora}
            onChangeText={setDiaHora}
          />

          <Text style={styles.label}>Duración (minutos) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 60"
            placeholderTextColor={COLORS.textMuted}
            value={duracion}
            onChangeText={(t) => setDuracion(t.replace(/\D/g, ""))}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Cupo</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 15"
            placeholderTextColor={COLORS.textMuted}
            value={cupo}
            onChangeText={(t) => setCupo(t.replace(/\D/g, ""))}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Profesor</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre del profesor"
            placeholderTextColor={COLORS.textMuted}
            value={profesor}
            onChangeText={setProfesor}
          />

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Detalles de la clase"
            placeholderTextColor={COLORS.textMuted}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Agregar clase</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Snackbar message={snackbar.message} type={snackbar.type} visible={snackbar.visible} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 22, paddingBottom: 40 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24, alignSelf: "flex-start" },
  back: { color: COLORS.green, fontSize: 15 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: COLORS.textMuted, marginTop: 6, marginBottom: 22 },
  card: { backgroundColor: COLORS.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  label: { color: COLORS.text, fontSize: 14, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  button: { backgroundColor: COLORS.greenDark, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 22 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
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
