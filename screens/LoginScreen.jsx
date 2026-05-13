import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function redirectByRole(rol) {
    if (rol === "usuario") {
      navigation.replace("Tabs");
      return;
    }

    if (rol === "gimnasio") {
      navigation.replace("GymOwnerHome");
      return;
    }

    if (rol === "empleador") {
      navigation.replace("EmployerHome");
      return;
    }

    Alert.alert("Error", "El usuario no tiene un rol válido.");
  }

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Campos incompletos", "Ingresá email y contraseña.");
      return;
    }

    try {
      console.log(
        "Login con:",
        cleanEmail,
        "password length:",
        cleanPassword.length
      );

      /*
        1) Iniciamos sesión con Firebase Authentication.
        Esto valida email y contraseña.
      */
      const userCredential = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        cleanPassword
      );

      const user = userCredential.user;

      if (!user.emailVerified) {
        await auth.signOut();
        Alert.alert(
          "Email no verificado",
          "Por favor, abrí el link que te mandamos por correo para verificar tu cuenta antes de ingresar."
        );
        return;
      }

      /*
        2) Buscamos el perfil del usuario en Firestore.
        Ahí está guardado el rol que elegimos en el registro.
      */
      const userDocRef = doc(db, "usuarios", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        Alert.alert(
          "Perfil no encontrado",
          "El usuario existe en Authentication, pero no tiene perfil guardado en Firestore."
        );
        return;
      }

      const userData = userDoc.data();

      /*
        3) Redirigimos según el rol.
      */
      redirectByRole(userData.rol);
    } catch (error) {
      console.log("Error login:", error.code, error.message);

      let message = "No se pudo iniciar sesión.";

      if (error.code === "auth/invalid-email") {
        message = "El email no es válido.";
      }

      if (error.code === "auth/user-not-found") {
        message = "No existe un usuario con ese email.";
      }

      if (error.code === "auth/wrong-password") {
        message = "La contraseña es incorrecta.";
      }

      if (error.code === "auth/invalid-credential") {
        message = "El email o la contraseña son incorrectos.";
      }

      if (error.code === "auth/too-many-requests") {
        message =
          "Se hicieron muchos intentos. Esperá un momento y probá de nuevo.";
      }

      if (error.code === "permission-denied") {
        message =
          "No tenés permisos para leer el perfil del usuario en Firestore. Revisá las reglas.";
      }

      Alert.alert("Error al iniciar sesión", message);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>GymPass</Text>
          <Text style={styles.subtitle}>Entrená donde quieras</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Iniciar sesión</Text>

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

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu contraseña"
            placeholderTextColor={COLORS.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
            <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Ingresar</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.register}>
              ¿No tenés cuenta?{" "}
              <Text style={styles.registerStrong}>Registrate</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    justifyContent: "center",
    padding: 22,
  },
  header: {
    marginBottom: 28,
  },
  logo: {
    color: COLORS.green,
    fontSize: 38,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginTop: 4,
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
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 22,
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 8,
    marginTop: 10,
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
  forgot: {
    color: COLORS.green,
    textAlign: "right",
    marginTop: 12,
    marginBottom: 18,
  },
  button: {
    backgroundColor: COLORS.greenDark,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  register: {
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 18,
  },
  registerStrong: {
    color: COLORS.green,
    fontWeight: "700",
  },
});