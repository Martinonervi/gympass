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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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
};

const ROLES = [
  { label: "Usuario", value: "usuario" },
  { label: "Dueño de gimnasio", value: "gimnasio" },
  { label: "Empleador", value: "empleador" },
];

export default function RegisterScreen({ navigation }) {
  const [role, setRole] = useState("usuario");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleRegister() {
    const cleanNombre = nombre.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Validamos que los campos básicos estén completos antes de llamar a Firebase
    if (!cleanNombre || !cleanEmail || !cleanPassword) {
      Alert.alert("Campos incompletos", "Completá nombre, email y contraseña.");
      return;
    }

    // Firebase pide mínimo 6 caracteres para contraseñas con email/password
    if (cleanPassword.length < 6) {
      Alert.alert(
        "Contraseña inválida",
        "La contraseña debe tener al menos 6 caracteres."
      );
      return;
    }

    try {
      console.log(
        "Registrando con:",
        cleanEmail,
        "password length:",
        cleanPassword.length
      );

      /*
        1) Creamos el usuario en Firebase Authentication.
        Esto maneja email, contraseña, uid y sesión.
      */
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        cleanPassword
      );

      const user = userCredential.user;

      /*
        2) Guardamos los datos propios de nuestra app en Firestore.
        Usamos el mismo uid del usuario como id del documento.
      */
      await setDoc(doc(db, "usuarios", user.uid), {
        uid: user.uid,
        nombre: cleanNombre,
        email: cleanEmail,
        rol: role,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });

      Alert.alert("Cuenta creada", `Se creó la cuenta como ${role}.`);

      // Usamos replace para que no pueda volver al registro con el botón atrás
      navigation.replace("Tabs");
    } catch (error) {
      console.log("Error register:", error.code, error.message);

      let message = "No se pudo crear la cuenta.";

      if (error.code === "auth/email-already-in-use") {
        message = "Ese email ya está registrado.";
      }

      if (error.code === "auth/invalid-email") {
        message = "El email no es válido.";
      }

      if (error.code === "auth/weak-password") {
        message = "La contraseña es demasiado débil.";
      }

      if (error.code === "permission-denied") {
        message =
          "No tenés permisos para guardar el usuario en Firestore. Revisá las reglas o pedile acceso al dueño del proyecto.";
      }

      Alert.alert("Error al registrarse", message);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>
          Elegí el tipo de usuario y completá tus datos.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Tipo de cuenta</Text>

          <View style={styles.roles}>
            {ROLES.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.roleButton,
                  role === item.value && styles.roleButtonActive,
                ]}
                onPress={() => setRole(item.value)}
              >
                <Text
                  style={[
                    styles.roleText,
                    role === item.value && styles.roleTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre o razón social"
            placeholderTextColor={COLORS.textMuted}
            value={nombre}
            onChangeText={setNombre}
          />

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
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={COLORS.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>Crear cuenta</Text>
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
    marginBottom: 24,
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
  roles: {
    gap: 10,
    marginBottom: 8,
  },
  roleButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 13,
    backgroundColor: COLORS.input,
  },
  roleButtonActive: {
    borderColor: COLORS.green,
    backgroundColor: "#12351f",
  },
  roleText: {
    color: COLORS.textMuted,
  },
  roleTextActive: {
    color: COLORS.green,
    fontWeight: "700",
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