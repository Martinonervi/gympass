import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collectionGroup,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { useNavigation } from "@react-navigation/native";
import DismissKeyboard from "../components/DismissKeyboard";
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

export default function LinkCorporateAccountScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handleLinkAccount = async () => {
    const formattedEmail = email.trim().toLowerCase();
    if (!formattedEmail) {
      Alert.alert("Error", "Por favor ingresá un correo corporativo válido.");
      return;
    }

    setLoading(true);
    try {
      // 1. Buscar el email en todos los sub-colecciones "nomina" donde el estado sea "activo"
      const q = query(
        collectionGroup(db, "nomina"),
        where("email", "==", formattedEmail),
        where("estado", "==", "activo")
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert(
          "Error",
          "El correo no pertenece a una empresa válida o tu empleador aún no te dio de alta."
        );
        return;
      }

      // 2. Obtener el documento de la empresa
      // Asumimos que querySnapshot devuelve 1 documento (o tomamos el primero)
      const docSnap = querySnapshot.docs[0];
      const employerDocRef = docSnap.ref.parent.parent;
      const employerId = employerDocRef.id;

      const employerDoc = await getDoc(employerDocRef);
      if (!employerDoc.exists()) {
        Alert.alert("Error", "No se encontró la información de la empresa.");
        return;
      }

      const employerData = employerDoc.data();
      // El plan se guarda SIEMPRE en minúscula ("classic"/"platinum"/"black"),
      // igual que los planes individuales, porque así lo leen canAccessGym,
      // PLAN_ORDER y el resto de la app. El empleador lo guarda capitalizado.
      const planTipoDelEmpleador = (employerData.planTipo || "classic").toLowerCase();

      // 3. Actualizar el documento del usuario actual
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "No hay un usuario logueado.");
        return;
      }

      const userDocRef = doc(db, "usuarios", currentUser.uid);
      await updateDoc(userDocRef, {
        plan: planTipoDelEmpleador,
        empresaId: employerId,
        correoCorporativo: formattedEmail,
      });

      const planDisplay =
        planTipoDelEmpleador.charAt(0).toUpperCase() + planTipoDelEmpleador.slice(1);
      Alert.alert("¡Cuenta vinculada!", `Ahora tenés el plan ${planDisplay}`);
      navigation.goBack();
    } catch (error) {
      console.error("Error al vincular cuenta:", error);
      Alert.alert("Error", "Ocurrió un problema al vincular la cuenta. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScreenHeader title="Vincular Cuenta" onBack={() => navigation.goBack()} />
      <DismissKeyboard>
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          Ingresá tu correo corporativo para acceder a los beneficios de tu empresa.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Correo Corporativo</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="ejemplo@tuempresa.com"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLinkAccount}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} size="small" />
            ) : (
              <Text style={styles.buttonText}>Vincular Cuenta</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      </DismissKeyboard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    padding: 22,
    paddingTop: 40,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 22,
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
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
  },
  button: {
    backgroundColor: COLORS.green,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  backButton: {
    marginTop: 20,
    alignItems: "center",
    padding: 10,
  },
  backButtonText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: "600",
  },
});
