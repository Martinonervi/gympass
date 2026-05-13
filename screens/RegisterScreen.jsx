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
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
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

  // Datos comunes
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Datos para dueño de gimnasio
  const [nombreGimnasio, setNombreGimnasio] = useState("");
  const [razonSocialGimnasio, setRazonSocialGimnasio] = useState("");
  const [cuitGimnasio, setCuitGimnasio] = useState("");
  const [direccionGimnasio, setDireccionGimnasio] = useState("");
  const [contactoGimnasio, setContactoGimnasio] = useState("");

  // Datos para empleador
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cuitEmpleador, setCuitEmpleador] = useState("");
  const [contactoEmpleador, setContactoEmpleador] = useState("");

  function redirectByRole() {
    if (role === "usuario") {
      navigation.replace("Tabs");
      return;
    }

    if (role === "gimnasio") {
      navigation.replace("GymOwnerHome");
      return;
    }

    if (role === "empleador") {
      navigation.replace("EmployerHome");
      return;
    }

    navigation.replace("Tabs");
  }

  function validateRoleFields() {
    if (role === "gimnasio") {
      if (
        !nombreGimnasio.trim() ||
        !razonSocialGimnasio.trim() ||
        !cuitGimnasio.trim() ||
        !direccionGimnasio.trim() ||
        !contactoGimnasio.trim()
      ) {
        Alert.alert(
          "Campos incompletos",
          "Completá nombre del gimnasio, razón social, CUIT, dirección y contacto."
        );
        return false;
      }
    }

    if (role === "empleador") {
      if (
        !nombreEmpresa.trim() ||
        !razonSocial.trim() ||
        !cuitEmpleador.trim() ||
        !contactoEmpleador.trim()
      ) {
        Alert.alert(
          "Campos incompletos",
          "Completá nombre de la empresa, razón social, CUIT y contacto."
        );
        return false;
      }
    }

    return true;
  }

  async function handleRegister() {
    const cleanNombre = nombre.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Validamos datos comunes
    if (!cleanNombre || !cleanEmail || !cleanPassword) {
      Alert.alert("Campos incompletos", "Completá nombre, email y contraseña.");
      return;
    }

    const cantidadNumeros = (cleanPassword.match(/\d/g) || []).length;
    if (cleanPassword.length < 6 || cantidadNumeros < 2) {
      Alert.alert(
        "Contraseña inválida",
        "La contraseña debe tener al menos 6 caracteres y 2 números."
      );
      return;
    }

    // Validamos datos específicos según rol
    if (!validateRoleFields()) {
      return;
    }

    try {
      console.log(
        "Registrando con:",
        cleanEmail,
        "rol:",
        role,
        "password length:",
        cleanPassword.length
      );

      /*
        1) Creamos el usuario en Firebase Authentication.
        Esto guarda email, contraseña, uid y sesión.
      */
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        cleanPassword
      );

      const user = userCredential.user;

      await sendEmailVerification(user);

      /*
        2) Guardamos datos comunes en usuarios/{uid}.
        Esta colección sirve para saber quién es el usuario y qué rol tiene.
      */
      await setDoc(doc(db, "usuarios", user.uid), {
        uid: user.uid,
        nombre: cleanNombre,
        email: cleanEmail,
        rol: role,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });

      /*
        3) Si el usuario es dueño de gimnasio, guardamos datos específicos
        en gimnasios/{uid}.
      */
      if (role === "gimnasio") {
        await setDoc(doc(db, "gimnasios", user.uid), {
          duenioId: user.uid,
          nombreResponsable: cleanNombre,
          email: cleanEmail,
          nombreGimnasio: nombreGimnasio.trim(),
          razonSocial: razonSocialGimnasio.trim(),
          cuit: cuitGimnasio.trim(),
          direccion: direccionGimnasio.trim(),
          contacto: contactoGimnasio.trim(),
          estado: "pendiente_validacion",
          creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        });
      }

      /*
        4) Si el usuario es empleador, guardamos datos específicos
        en empleadores/{uid}.
      */
      if (role === "empleador") {
        await setDoc(doc(db, "empleadores", user.uid), {
          empleadorId: user.uid,
          nombreResponsable: cleanNombre,
          email: cleanEmail,
          nombreEmpresa: nombreEmpresa.trim(),
          razonSocial: razonSocial.trim(),
          cuit: cuitEmpleador.trim(),
          contacto: contactoEmpleador.trim(),
          estado: "pendiente_validacion",
          creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        });
      }

      Alert.alert(
        "Cuenta creada",
        `Se creó la cuenta como ${role}. Revisá tu casilla de correo para verificar tu email.`
      );

      await signOut(auth);

      navigation.replace("Login");
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
          "No tenés permisos para guardar datos en Firestore. Revisá las reglas.";
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

          <Text style={styles.sectionTitle}>Datos de la cuenta</Text>

          <Text style={styles.label}>
            {role === "usuario" ? "Nombre" : "Nombre del responsable"}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={
              role === "usuario" ? "Tu nombre" : "Nombre del responsable"
            }
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
            placeholder="Mínimo 6 caracteres y 2 números"
            placeholderTextColor={COLORS.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {role === "gimnasio" && (
            <>
              <Text style={styles.sectionTitle}>Datos del gimnasio</Text>

              <Text style={styles.label}>Nombre del gimnasio</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: SportClub Palermo"
                placeholderTextColor={COLORS.textMuted}
                value={nombreGimnasio}
                onChangeText={setNombreGimnasio}
              />

              <Text style={styles.label}>Razón social</Text>
              <TextInput
                style={styles.input}
                placeholder="Razón social del gimnasio"
                placeholderTextColor={COLORS.textMuted}
                value={razonSocialGimnasio}
                onChangeText={setRazonSocialGimnasio}
              />

              <Text style={styles.label}>CUIT</Text>
              <TextInput
                style={styles.input}
                placeholder="CUIT del gimnasio"
                placeholderTextColor={COLORS.textMuted}
                value={cuitGimnasio}
                onChangeText={setCuitGimnasio}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Dirección</Text>
              <TextInput
                style={styles.input}
                placeholder="Dirección del gimnasio"
                placeholderTextColor={COLORS.textMuted}
                value={direccionGimnasio}
                onChangeText={setDireccionGimnasio}
              />

              <Text style={styles.label}>Teléfono de contacto</Text>
              <TextInput
                style={styles.input}
                placeholder="Teléfono de contacto"
                placeholderTextColor={COLORS.textMuted}
                value={contactoGimnasio}
                onChangeText={(text) => setContactoGimnasio(text.replace(/\D/g, ""))}
                keyboardType="numeric"
              />

            </>
          )}

          {role === "empleador" && (
            <>
              <Text style={styles.sectionTitle}>Datos de la empresa</Text>

              <Text style={styles.label}>Nombre de la empresa</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre comercial de la empresa"
                placeholderTextColor={COLORS.textMuted}
                value={nombreEmpresa}
                onChangeText={setNombreEmpresa}
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
                value={cuitEmpleador}
                onChangeText={setCuitEmpleador}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Teléfono de contacto</Text>
              <TextInput
                style={styles.input}
                placeholder="Teléfono de contacto"
                placeholderTextColor={COLORS.textMuted}
                value={contactoEmpleador}
                onChangeText={(text) => setContactoEmpleador(text.replace(/\D/g, ""))}
                keyboardType="numeric"
              />
            </>
          )}

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