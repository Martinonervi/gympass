import React, { useState, useEffect, useRef } from "react";
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
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import ScreenHeader from "../components/ScreenHeader";

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
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
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
  const [snackbar, setSnackbar] = useState({
    visible: false,
    message: "",
    type: "error",
  });
  const timerRef = useRef(null);

  function showSnackbar(message, type = "error", duration = 3500) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSnackbar({ visible: true, message, type });
    timerRef.current = setTimeout(() => {
      setSnackbar((prev) => ({ ...prev, visible: false }));
    }, duration);
  }

  return { snackbar, showSnackbar };
}

// ─── EditEmployerInfoScreen ──────────────────────────────────────────────────
export default function EditEmployerInfoScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { snackbar, showSnackbar } = useSnackbar();

  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [nombreResponsable, setNombreResponsable] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit] = useState("");
  const [contacto, setContacto] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const empRef = doc(db, "empleadores", user.uid);
        const empSnap = await getDoc(empRef);

        if (empSnap.exists()) {
          const data = empSnap.data();
          setNombreEmpresa(data.nombreEmpresa || "");
          setNombreResponsable(data.nombreResponsable || "");
          setRazonSocial(data.razonSocial || "");
          setCuit(data.cuit || "");
          setContacto(data.contacto || "");
        }
        // Si no existe, los campos quedan vacíos.
      } catch (error) {
        console.error("Error cargando empleador:", error);
        showSnackbar("No se pudo cargar la información de la empresa.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  async function handleSave() {
    const user = auth.currentUser;
    if (!user) {
      showSnackbar("No hay un usuario autenticado.");
      return;
    }

    if (!nombreEmpresa.trim()) {
      showSnackbar("El nombre de la empresa es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const empRef = doc(db, "empleadores", user.uid);

      await setDoc(
        empRef,
        {
          empleadorId: user.uid,
          nombreEmpresa: nombreEmpresa.trim(),
          nombreResponsable: nombreResponsable.trim(),
          razonSocial: razonSocial.trim(),
          cuit: cuit.trim(),
          contacto: contacto.trim(),
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );

      showSnackbar("Información de la empresa guardada.", "success");

      setTimeout(() => {
        navigation.goBack();
      }, 800);
    } catch (error) {
      console.log("Error guardando empleador:", error.code, error.message);
      let message = "No se pudo guardar la información.";
      if (error.code === "permission-denied") {
        message =
          "No tenés permisos para guardar. Revisá las reglas de Firestore.";
      }
      showSnackbar(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.green} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScreenHeader title="Información de la empresa" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={styles.subtitle}>
          Completá o actualizá los datos de tu empresa.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Datos de la empresa</Text>

          <Text style={styles.label}>Nombre de la empresa</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre comercial de la empresa"
            placeholderTextColor={COLORS.textMuted}
            value={nombreEmpresa}
            onChangeText={setNombreEmpresa}
          />

          <Text style={styles.label}>Nombre del responsable</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre y apellido"
            placeholderTextColor={COLORS.textMuted}
            value={nombreResponsable}
            onChangeText={setNombreResponsable}
          />

          <Text style={styles.label}>Razón social</Text>
          <TextInput
            style={styles.input}
            placeholder="Razón social de la empresa"
            placeholderTextColor={COLORS.textMuted}
            value={razonSocial}
            onChangeText={setRazonSocial}
          />

          <Text style={styles.label}>CUIT</Text>
          <TextInput
            style={styles.input}
            placeholder="CUIT de la empresa"
            placeholderTextColor={COLORS.textMuted}
            value={cuit}
            onChangeText={setCuit}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Teléfono de contacto</Text>
          <TextInput
            style={styles.input}
            placeholder="Teléfono de contacto"
            placeholderTextColor={COLORS.textMuted}
            value={contacto}
            onChangeText={(text) => setContacto(text.replace(/\D/g, ""))}
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Snackbar
        message={snackbar.message}
        type={snackbar.type}
        visible={snackbar.visible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    padding: 22,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
    alignSelf: "flex-start",
  },
  back: {
    color: COLORS.green,
    fontSize: 15,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 22,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.green,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    backgroundColor: COLORS.greenDark,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 22,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
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
  snackbarError: {
    backgroundColor: "#1f0a0a",
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  snackbarSuccess: {
    backgroundColor: "#0a1f0e",
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  snackbarIcon: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  snackbarText: {
    color: COLORS.text,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});
