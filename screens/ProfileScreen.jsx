import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut, reload } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { useNavigation } from "@react-navigation/native";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  greenDark: "#16a34a",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  input: "#111827",
  red: "#ef4444",
};

// ─── Snackbar ─────────────────────────────────────────────────────────────────
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

// ─── Hook ─────────────────────────────────────────────────────────────────────
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

// ─── ProfileScreen ────────────────────────────────────────────────────────────
export default function ProfileScreen({ setIsSignedIn }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { snackbar, showSnackbar } = useSnackbar();
  const navigation = useNavigation();

  const [rol, setRol] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");

  // Datos para gimnasio
  const [nombreGimnasio, setNombreGimnasio] = useState("");
  const [razonSocialGimnasio, setRazonSocialGimnasio] = useState("");
  const [cuitGimnasio, setCuitGimnasio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contactoGimnasio, setContactoGimnasio] = useState("");

  // Datos para empleador
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cuitEmpleador, setCuitEmpleador] = useState("");
  const [contacto, setContacto] = useState("");

  function limpiarNumeros(text) {
    return text.replace(/\D/g, "");
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;

        if (!user) {
          setLoading(false);
          return;
        }

        await reload(user);

        const currentUser = auth.currentUser;
        const authEmail = currentUser?.email || user.email || "";

        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const currentRol = userData.rol || "usuario";

          if (authEmail && authEmail !== userData.email) {
            await updateDoc(userDocRef, {
              email: authEmail,
              emailPendiente: null,
              emailPendienteEn: null,
            });
          }

          setRol(currentRol);
          setNombre(userData.nombre || "");
          setEmail(authEmail || userData.email || "");

          if (currentRol === "gimnasio") {
            const gymDocRef = doc(db, "gimnasios", user.uid);
            const gymDocSnap = await getDoc(gymDocRef);

            if (gymDocSnap.exists()) {
              const gymData = gymDocSnap.data();
              setNombreGimnasio(gymData.nombreGimnasio || "");
              setRazonSocialGimnasio(gymData.razonSocial || "");
              setCuitGimnasio(gymData.cuit || "");
              setDireccion(gymData.direccion || "");
              setContactoGimnasio(gymData.contacto || "");
            }
          } else if (currentRol === "empleador") {
            const empDocRef = doc(db, "empleadores", user.uid);
            const empDocSnap = await getDoc(empDocRef);

            if (empDocSnap.exists()) {
              const empData = empDocSnap.data();
              setNombreEmpresa(empData.nombreEmpresa || "");
              setRazonSocial(empData.razonSocial || "");
              setCuitEmpleador(empData.cuit || "");
              setContacto(empData.contacto || "");
            }
          }
        }
      } catch (error) {
        showSnackbar("Hubo un problema al cargar los datos.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleUpdate = async () => {
    const cleanNombre = nombre.trim();

    if (!cleanNombre) {
      showSnackbar("El campo nombre es obligatorio.");
      return;
    }

    if (rol === "gimnasio") {
      if (
        !nombreGimnasio.trim() ||
        !razonSocialGimnasio.trim() ||
        !cuitGimnasio.trim() ||
        !direccion.trim() ||
        !contactoGimnasio.trim()
      ) {
        showSnackbar(
          "Completá nombre del gimnasio, razón social, CUIT, dirección y teléfono."
        );
        return;
      }
    }

    if (rol === "empleador") {
      if (
        !nombreEmpresa.trim() ||
        !razonSocial.trim() ||
        !cuitEmpleador.trim() ||
        !contacto.trim()
      ) {
        showSnackbar(
          "Completá nombre de la empresa, razón social, CUIT y teléfono."
        );
        return;
      }
    }

    try {
      setSaving(true);

      const user = auth.currentUser;

      if (!user) throw new Error("No hay usuario autenticado.");

      const userDocRef = doc(db, "usuarios", user.uid);
      await updateDoc(userDocRef, { nombre: cleanNombre });

      if (rol === "gimnasio") {
        const gymDocRef = doc(db, "gimnasios", user.uid);
        await updateDoc(gymDocRef, {
          nombreGimnasio: nombreGimnasio.trim(),
          razonSocial: razonSocialGimnasio.trim(),
          cuit: limpiarNumeros(cuitGimnasio),
          direccion: direccion.trim(),
          contacto: limpiarNumeros(contactoGimnasio),
        });
      } else if (rol === "empleador") {
        const empDocRef = doc(db, "empleadores", user.uid);
        await updateDoc(empDocRef, {
          nombreEmpresa: nombreEmpresa.trim(),
          razonSocial: razonSocial.trim(),
          cuit: limpiarNumeros(cuitEmpleador),
          contacto: limpiarNumeros(contacto),
        });
      }

      showSnackbar("Tus datos se actualizaron correctamente.", "success");
    } catch (error) {
      showSnackbar("No se pudieron actualizar los datos.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged en App.js detecta el logout y cambia la navegación automáticamente
      setIsSignedIn(false);
    } catch (error) {
      showSnackbar("No se pudo cerrar sesión.");
      console.error(error);
    }
  };

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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Mi Perfil</Text>
        <Text style={styles.subtitle}>Actualizá tus datos personales.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>
            {rol === "usuario" ? "Nombre" : "Nombre del responsable"}
          </Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder={
              rol === "usuario" ? "Tu nombre" : "Nombre del responsable"
            }
            placeholderTextColor={COLORS.textMuted}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={email}
            editable={false}
            placeholder="Tu email"
            placeholderTextColor={COLORS.textMuted}
          />

          {rol === "gimnasio" && (
            <>
              <Text style={styles.sectionTitle}>Datos del gimnasio</Text>

              <Text style={styles.label}>Nombre del gimnasio</Text>
              <TextInput
                style={styles.input}
                value={nombreGimnasio}
                onChangeText={setNombreGimnasio}
                placeholder="Ej: SportClub Palermo"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Razón social</Text>
              <TextInput
                style={styles.input}
                value={razonSocialGimnasio}
                onChangeText={setRazonSocialGimnasio}
                placeholder="Razón social del gimnasio"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>CUIT</Text>
              <TextInput
                style={styles.input}
                value={cuitGimnasio}
                onChangeText={(text) => setCuitGimnasio(limpiarNumeros(text))}
                placeholder="CUIT del gimnasio"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Dirección</Text>
              <TextInput
                style={styles.input}
                value={direccion}
                onChangeText={setDireccion}
                placeholder="Dirección del gimnasio"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Teléfono de contacto</Text>
              <TextInput
                style={styles.input}
                value={contactoGimnasio}
                onChangeText={(text) =>
                  setContactoGimnasio(limpiarNumeros(text))
                }
                placeholder="Teléfono de contacto"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </>
          )}

          {rol === "empleador" && (
            <>
              <Text style={styles.sectionTitle}>Datos de la empresa</Text>

              <Text style={styles.label}>Nombre de la empresa</Text>
              <TextInput
                style={styles.input}
                value={nombreEmpresa}
                onChangeText={setNombreEmpresa}
                placeholder="Nombre comercial de la empresa"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Razón social</Text>
              <TextInput
                style={styles.input}
                value={razonSocial}
                onChangeText={setRazonSocial}
                placeholder="Razón social de la empresa"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>CUIT</Text>
              <TextInput
                style={styles.input}
                value={cuitEmpleador}
                onChangeText={(text) => setCuitEmpleador(limpiarNumeros(text))}
                placeholder="CUIT de la empresa"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Teléfono de contacto</Text>
              <TextInput
                style={styles.input}
                value={contacto}
                onChangeText={(text) => setContacto(limpiarNumeros(text))}
                placeholder="Teléfono de contacto"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleUpdate}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.buttonText}>Guardar cambios</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("ChangeLoginData")}
          >
            <Text style={styles.secondaryButtonText}>
              Cambiar datos de inicio de sesión
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Snackbar — fuera del ScrollView para que quede fijo al fondo */}
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    padding: 22,
    paddingBottom: 40,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
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
    marginTop: 20,
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
  disabledInput: {
    opacity: 0.7,
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
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: COLORS.green,
    fontSize: 16,
    fontWeight: "700",
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 12,
  },
  logoutButtonText: {
    color: COLORS.red,
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Snackbar ──────────────────────────────────────────────────────────────
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
    borderColor: COLORS.red,
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