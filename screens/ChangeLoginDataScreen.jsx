import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  updatePassword,
} from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { MaterialCommunityIcons } from '@expo/vector-icons';


const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  greenDark: "#16a34a",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  input: "#111827",
};

export default function ChangeLoginDataScreen({ navigation }) {
  const [newEmail, setNewEmail] = useState(auth.currentUser?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const currentEmail = auth.currentUser?.email || "";

  function validarEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function passwordTieneDosNumeros(password) {
    const cantidadNumeros = (password.match(/\d/g) || []).length;
    return cantidadNumeros >= 2;
  }

  async function handleSaveLoginData() {
    const cleanNewEmail = newEmail.trim().toLowerCase();
    const cleanCurrentPassword = currentPassword.trim();
    const cleanNewPassword = newPassword.trim();
    const cleanConfirmNewPassword = confirmNewPassword.trim();

    const emailCambio = cleanNewEmail !== currentEmail.toLowerCase();
    const passwordCambio =
      cleanNewPassword.length > 0 || cleanConfirmNewPassword.length > 0;

    if (!cleanNewEmail) {
      Alert.alert("Email requerido", "Ingresá un email.");
      return;
    }

    if (!validarEmail(cleanNewEmail)) {
      Alert.alert("Email inválido", "Ingresá un email válido.");
      return;
    }

    if (!emailCambio && !passwordCambio) {
      Alert.alert("Sin cambios", "No modificaste el email ni la contraseña.");
      return;
    }

    if (!cleanCurrentPassword) {
      Alert.alert(
        "Contraseña requerida",
        "Ingresá tu contraseña actual para confirmar los cambios."
      );
      return;
    }

    if (passwordCambio) {
      if (!cleanNewPassword || !cleanConfirmNewPassword) {
        Alert.alert(
          "Contraseña incompleta",
          "Ingresá y confirmá la nueva contraseña."
        );
        return;
      }

      if (cleanNewPassword !== cleanConfirmNewPassword) {
        Alert.alert(
          "Las contraseñas no coinciden",
          "La nueva contraseña y la confirmación deben ser iguales."
        );
        return;
      }

      if (
        cleanNewPassword.length < 6 ||
        !passwordTieneDosNumeros(cleanNewPassword)
      ) {
        Alert.alert(
          "Contraseña inválida",
          "La nueva contraseña debe tener al menos 6 caracteres y 2 números."
        );
        return;
      }
    }

    try {
      setSaving(true);

      const user = auth.currentUser;

      if (!user || !user.email) {
        throw new Error("No hay usuario autenticado.");
      }

      const credential = EmailAuthProvider.credential(
        user.email,
        cleanCurrentPassword
      );

      await reauthenticateWithCredential(user, credential);

      if (emailCambio) {
        await verifyBeforeUpdateEmail(user, cleanNewEmail);

        const userDocRef = doc(db, "usuarios", user.uid);
        await updateDoc(userDocRef, {
          emailPendiente: cleanNewEmail,
          emailPendienteEn: serverTimestamp(),
        });
      }

      if (passwordCambio) {
        await updatePassword(user, cleanNewPassword);
      }

      if (emailCambio && passwordCambio) {
        Alert.alert(
          "Revisá tu email",
          "Si el email está disponible, vas a recibir un correo de verificación. La contraseña ya fue actualizada. El email cambiará cuando confirmes ese correo.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ]
        );
        return;
      }

      if (emailCambio) {
        Alert.alert(
          "Revisá tu email",
          "Si el email está disponible, vas a recibir un correo de verificación. El cambio se aplica cuando confirmás ese correo.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ]
        );
        return;
      }

      Alert.alert(
        "Datos actualizados",
        "Tu contraseña se actualizó correctamente.",
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error(error);

      let message = "No se pudieron actualizar los datos de inicio de sesión.";

      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        message = "La contraseña actual es incorrecta.";
      }

      if (error.code === "auth/email-already-in-use") {
        message = "Ese email ya está registrado por otra cuenta.";
      }

      if (error.code === "auth/invalid-email") {
        message = "El email no es válido.";
      }

      if (error.code === "auth/weak-password") {
        message = "La nueva contraseña es demasiado débil.";
      }

      if (error.code === "auth/requires-recent-login") {
        message =
          "Por seguridad, volvé a iniciar sesión e intentá nuevamente.";
      }

      if (error.code === "auth/operation-not-allowed") {
        message =
          "Firebase no permite cambiar el email directamente. Se debe verificar el nuevo email antes de cambiarlo.";
      }

      Alert.alert("Error", message);
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
        

        <Text style={styles.title}>Datos de inicio de sesión</Text>
        <Text style={styles.subtitle}>
          Podés cambiar tu email, tu contraseña o ambos. Para confirmar
          cualquier cambio, te vamos a pedir tu contraseña actual.
        </Text>

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>
            Cambiar email
          </Text>
          <Text style={styles.helper}>
            Completá este campo solo si querés cambiar el email de inicio de
            sesión. Si el email está disponible, te enviaremos un correo de
            verificación.
          </Text>

          <Text style={styles.label}>Nuevo email</Text>
          <TextInput
            style={styles.input}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="Nuevo email"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.sectionTitle}>Cambiar contraseña</Text>
          <Text style={styles.helper}>
            Completá estos campos solo si querés cambiar tu contraseña.
          </Text>

          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Mínimo 6 caracteres y 2 números"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
          />

          <Text style={styles.label}>Confirmar nueva contraseña</Text>
          <TextInput
            style={styles.input}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder="Repetí la nueva contraseña"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
          />

          <Text style={styles.sectionTitle}>Confirmar cambios</Text>
          <Text style={styles.helper}>
            Ingresá tu contraseña actual para guardar los cambios que hayas
            realizado.
          </Text>

          <Text style={styles.label}>Contraseña actual</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Contraseña actual"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleSaveLoginData}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.buttonText}>
                Guardar cambios de inicio de sesión
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    padding: 22,
    paddingBottom: 40,
  },
  back: {
    color: COLORS.green,
    fontSize: 15,
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
    padding: 16,
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
  firstSectionTitle: {
    marginTop: 0,
  },
  helper: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 8,
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
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
    alignSelf: "flex-start",
  },
});