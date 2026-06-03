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

const getCoordinates = async (address) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
    {
      headers: {
        "User-Agent": "Gympass/1.0"
      }
    }
  );

  const data = await res.json();

  if (!data.length) throw new Error("No encontrado");

  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
  };
};

// ─── Snackbar (mismo patrón que el resto de la app) ──────────────────────────
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

// ─── EditGymInfoScreen ───────────────────────────────────────────────────────
export default function EditGymInfoScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { snackbar, showSnackbar } = useSnackbar();

  const [nombreGimnasio, setNombreGimnasio] = useState("");
  const [nombreResponsable, setNombreResponsable] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contacto, setContacto] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const gymRef = doc(db, "gimnasios", user.uid);
        const gymSnap = await getDoc(gymRef);

        if (gymSnap.exists()) {
          const data = gymSnap.data();
          setNombreGimnasio(data.nombreGimnasio || "");
          setNombreResponsable(data.nombreResponsable || "");
          setRazonSocial(data.razonSocial || "");
          setCuit(data.cuit || "");
          setDireccion(data.direccion || "");
          setContacto(data.contacto || "");
        }
        // Si no existe, los campos quedan vacíos.
      } catch (error) {
        console.error("Error cargando gimnasio:", error);
        showSnackbar("No se pudo cargar la información del gimnasio.");
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

    if (!nombreGimnasio.trim()) {
      showSnackbar("El nombre del gimnasio es obligatorio.");
      return;
    }

    if (!direccion.trim()) {
      showSnackbar("La dirección es obligatoria para mostrar el gym en el mapa.");
      return;
    }

    setSaving(true);
    try {
      const gymRef = doc(db, "gimnasios", user.uid);

      let coords = null;
      try {
        coords = await getCoordinates(direccion);
      } catch (e) {
        console.log("Error geocoding:", e.message);
      }

      await setDoc(
        gymRef,
        {
          duenioId: user.uid,
          nombreGimnasio: nombreGimnasio.trim(),
          nombreResponsable: nombreResponsable.trim(),
          razonSocial: razonSocial.trim(),
          cuit: cuit.trim(),
          direccion: direccion.trim(),
          ...(coords && {
            latitude: coords.latitude,
            longitude: coords.longitude,
          }),
          contacto: contacto.trim(),
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );

      showSnackbar("Información del gimnasio guardada.", "success");

      // Pequeño delay para que se vea el mensaje antes de volver.
      setTimeout(() => {
        navigation.goBack();
      }, 800);
    } catch (error) {
      console.log("Error guardando gimnasio:", error.code, error.message);
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

      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={COLORS.green}
          />
          <Text style={styles.back}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Información del gimnasio</Text>
        <Text style={styles.subtitle}>
          Completá o actualizá los datos de tu gimnasio.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Datos generales</Text>

          <Text style={styles.label}>Nombre del gimnasio</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: SportClub Palermo"
            placeholderTextColor={COLORS.textMuted}
            value={nombreGimnasio}
            onChangeText={setNombreGimnasio}
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
            placeholder="Razón social del gimnasio"
            placeholderTextColor={COLORS.textMuted}
            value={razonSocial}
            onChangeText={setRazonSocial}
          />

          <Text style={styles.label}>CUIT</Text>
          <TextInput
            style={styles.input}
            placeholder="CUIT del gimnasio"
            placeholderTextColor={COLORS.textMuted}
            value={cuit}
            onChangeText={setCuit}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Dirección</Text>
          <TextInput
            style={styles.input}
            placeholder="Dirección del gimnasio"
            placeholderTextColor={COLORS.textMuted}
            value={direccion}
            onChangeText={setDireccion}
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
