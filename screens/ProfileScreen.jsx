import React, { useState, useEffect } from "react";
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
import { doc, getDoc, updateDoc } from "firebase/firestore";
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

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rol, setRol] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");

  const [nombreGimnasio, setNombreGimnasio] = useState("");
  const [direccion, setDireccion] = useState("");

  const [razonSocial, setRazonSocial] = useState("");
  const [contacto, setContacto] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const currentRol = userData.rol || "usuario";
          setRol(currentRol);
          setNombre(userData.nombre || "");
          setEmail(userData.email || "");

          if (currentRol === "gimnasio") {
            const gymDocRef = doc(db, "gimnasios", user.uid);
            const gymDocSnap = await getDoc(gymDocRef);
            if (gymDocSnap.exists()) {
              const gymData = gymDocSnap.data();
              setNombreGimnasio(gymData.nombreGimnasio || "");
              setDireccion(gymData.direccion || "");
            }
          } else if (currentRol === "empleador") {
            const empDocRef = doc(db, "empleadores", user.uid);
            const empDocSnap = await getDoc(empDocRef);
            if (empDocSnap.exists()) {
              const empData = empDocSnap.data();
              setRazonSocial(empData.razonSocial || "");
              setContacto(empData.contacto || "");
            }
          }
        }
      } catch (error) {
        Alert.alert("Error", "Hubo un problema al cargar los datos.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleUpdate = async () => {
    const cleanNombre = nombre.trim();
    const cleanEmail = email.trim();

    // Validación de vacíos (comunes)
    if (!cleanNombre || !cleanEmail) {
      Alert.alert("Error", "Los campos Nombre y Email son obligatorios.");
      return;
    }

    // Validación de vacíos (específicos)
    if (rol === "gimnasio") {
      if (!nombreGimnasio.trim() || !direccion.trim()) {
        Alert.alert("Error", "Nombre del gimnasio y dirección son obligatorios.");
        return;
      }
    } else if (rol === "empleador") {
      if (!razonSocial.trim() || !contacto.trim()) {
        Alert.alert("Error", "Razón social y contacto son obligatorios.");
        return;
      }
    }

    // Validación de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert("Error", "El formato del email es inválido.");
      return;
    }

    try {
      setSaving(true);
      const user = auth.currentUser;
      if (!user) throw new Error("No hay usuario autenticado.");

      const userDocRef = doc(db, "usuarios", user.uid);
      await updateDoc(userDocRef, {
        nombre: cleanNombre,
        email: cleanEmail,
      });

      if (rol === "gimnasio") {
        const gymDocRef = doc(db, "gimnasios", user.uid);
        await updateDoc(gymDocRef, {
          nombreGimnasio: nombreGimnasio.trim(),
          direccion: direccion.trim(),
        });
      } else if (rol === "empleador") {
        const empDocRef = doc(db, "empleadores", user.uid);
        await updateDoc(empDocRef, {
          razonSocial: razonSocial.trim(),
          contacto: contacto.trim(),
        });
      }

      Alert.alert("Éxito", "Tus datos se han actualizado correctamente");
    } catch (error) {
      Alert.alert("Error", "No se pudieron actualizar los datos.");
      console.error(error);
    } finally {
      setSaving(false);
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
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Tu nombre"
            placeholderTextColor={COLORS.textMuted}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Tu email"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {rol === "gimnasio" && (
            <>
              <Text style={styles.sectionTitle}>Datos del Gimnasio</Text>
              <Text style={styles.label}>Nombre del Gimnasio</Text>
              <TextInput
                style={styles.input}
                value={nombreGimnasio}
                onChangeText={setNombreGimnasio}
                placeholder="Nombre del gimnasio"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Dirección</Text>
              <TextInput
                style={styles.input}
                value={direccion}
                onChangeText={setDireccion}
                placeholder="Dirección del gimnasio"
                placeholderTextColor={COLORS.textMuted}
              />
            </>
          )}

          {rol === "empleador" && (
            <>
              <Text style={styles.sectionTitle}>Datos del Empleador</Text>
              <Text style={styles.label}>Razón Social</Text>
              <TextInput
                style={styles.input}
                value={razonSocial}
                onChangeText={setRazonSocial}
                placeholder="Razón Social"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Contacto</Text>
              <TextInput
                style={styles.input}
                value={contacto}
                onChangeText={setContacto}
                placeholder="Teléfono o email de contacto"
                placeholderTextColor={COLORS.textMuted}
              />
            </>
          )}

          <TouchableOpacity style={styles.button} onPress={handleUpdate} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.buttonText}>Guardar Cambios</Text>
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