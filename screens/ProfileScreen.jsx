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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut, reload } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
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
  orange: "#f97316",
  orangeDark: "#c2410c",
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
//
// Esta pantalla muestra SOLO los datos comunes a los 3 roles (datos de cuenta):
//   - email (readonly)
//   - cambiar datos de inicio de sesión
//   - cerrar sesión
//
// Los datos específicos de cada rol viven en sus propias pantallas:
//   - usuario   → EditUserInfo
//   - gimnasio  → EditGymInfo
//   - empleador → EditEmployerInfo
//
export default function ProfileScreen({ setIsSignedIn, userRole }) {
  const [loading, setLoading] = useState(true);
  const { snackbar, showSnackbar } = useSnackbar();
  const navigation = useNavigation();

  // Seed rol immediately from the prop so goToEditInfo() works even before
  // the Firestore fetch completes. The useEffect still syncs email and will
  // confirm (or override) the role once the fetch resolves.
  const [rol, setRol] = useState(userRole || "");
  const [email, setEmail] = useState("");

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportText, setReportText] = useState("");
  const [sendingReport, setSendingReport] = useState(false);

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

          // Mantener email sincronizado con Auth si cambió.
          if (authEmail && authEmail !== userData.email) {
            await updateDoc(userDocRef, {
              email: authEmail,
              emailPendiente: null,
              emailPendienteEn: null,
            });
          }

          setRol(currentRol);
          setEmail(authEmail || userData.email || "");
        } else {
          // Si todavía no existe el doc, igual mostramos el email de Auth.
          setEmail(authEmail);
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

  function goToEditInfo() {
    if (rol === "gimnasio") {
      navigation.navigate("EditGymInfo");
      return;
    }
    if (rol === "empleador") {
      navigation.navigate("EditEmployerInfo");
      return;
    }
    navigation.navigate("EditUserInfo");
  }

  function getEditButtonLabel() {
    if (rol === "gimnasio") return "Editar información del gimnasio";
    if (rol === "empleador") return "Editar información de la empresa";
    return "Editar mis datos";
  }

  const handleSendReport = async () => {
    if (!reportText.trim()) {
      showSnackbar("Escribí un mensaje antes de enviar.");
      return;
    }
    setSendingReport(true);
    try {
      const user = auth.currentUser;
      const coleccion = rol === "gimnasio" ? "reportes_gimnasios" : "reportes_usuarios";
      await addDoc(collection(db, coleccion), {
        uid: user?.uid || null,
        email: email || null,
        mensaje: reportText.trim(),
        creadoEn: serverTimestamp(),
        leido: false,
      });
      // Send a support acknowledgment notification to the user
      if (user?.uid) {
        await addDoc(collection(db, "usuarios", user.uid, "notificaciones"), {
          tipo: "soporte",
          titulo: "Reporte recibido ✓",
          mensaje: "Recibimos tu reporte. Nuestro equipo de soporte revisará tu situación y se comunicará con vos a la brevedad. ¡Gracias por ayudarnos a mejorar!",
          leida: false,
          creadoEn: serverTimestamp(),
        });
      }
      setReportModalVisible(false);
      setReportText("");
      showSnackbar("Reporte enviado con éxito. ¡Gracias!", "success");
    } catch (error) {
      console.error(error);
      showSnackbar("No se pudo enviar el reporte. Intentá de nuevo.");
    } finally {
      setSendingReport(false);
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
        <Text style={styles.subtitle}>Datos de tu cuenta.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={email}
            editable={false}
            placeholder="Tu email"
            placeholderTextColor={COLORS.textMuted}
          />

          <TouchableOpacity style={styles.button} onPress={goToEditInfo}>
            <Text style={styles.buttonText}>{getEditButtonLabel()}</Text>
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

        {(rol === "usuario" || rol === "gimnasio") && (
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => setReportModalVisible(true)}
          >
            <Text style={styles.reportButtonIcon}>⚑</Text>
            <Text style={styles.reportButtonText}>Soporte de aplicación</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reportar un problema</Text>
            <Text style={styles.modalSubtitle}>
              Describí el problema. Nuestro equipo de soporte lo revisará.
            </Text>

            <TextInput
              style={styles.reportInput}
              value={reportText}
              onChangeText={setReportText}
              placeholder="Escribí tu mensaje acá..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.charCount}>{reportText.length}/1000</Text>

            <TouchableOpacity
              style={[styles.sendButton, sendingReport && styles.sendButtonDisabled]}
              onPress={handleSendReport}
              disabled={sendingReport}
            >
              {sendingReport ? (
                <ActivityIndicator color={COLORS.text} size="small" />
              ) : (
                <Text style={styles.sendButtonText}>Enviar reporte</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { setReportModalVisible(false); setReportText(""); }}
              disabled={sendingReport}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

  // ── Report button ─────────────────────────────────────────────────────────
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.orange,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  reportButtonIcon: {
    color: COLORS.orange,
    fontSize: 16,
  },
  reportButtonText: {
    color: COLORS.orange,
    fontSize: 15,
    fontWeight: "600",
  },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 19,
  },
  reportInput: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 120,
    fontSize: 14,
  },
  charCount: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: COLORS.orange,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  cancelButtonText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: "600",
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
