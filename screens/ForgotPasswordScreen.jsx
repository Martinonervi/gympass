import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebaseConfig";

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

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");

  async function handleResetPassword() {
    if (!email.trim()) {
      Alert.alert("Email requerido", "Ingresá tu email para recuperar la contraseña.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert("Correo enviado", "Revisá tu casilla para recuperar la contraseña.");
      navigation.goBack();
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "No se pudo enviar el correo de recuperación.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Volver</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.title}>Recuperar contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresá tu email y te enviamos un link para restablecerla.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="usuario@mail.com"
            placeholderTextColor={COLORS.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
            <Text style={styles.buttonText}>Enviar correo</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    justifyContent: "center",
  },
  back: {
    color: COLORS.green,
    fontSize: 15,
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textMuted,
    marginBottom: 20,
    lineHeight: 20,
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
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
});