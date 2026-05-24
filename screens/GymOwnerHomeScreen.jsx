import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const COLORS = {
  bg: "#0f1520",
  green: "#22c55e",
  greenDark: "#16a34a",
  text: "#ffffff",
  textMuted: "#94a3b8",
};

export default function GymOwnerHomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [nombreGimnasio, setNombreGimnasio] = useState("");

  useEffect(() => {
    const fetchGym = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const gymSnap = await getDoc(doc(db, "gimnasios", user.uid));
        if (gymSnap.exists()) {
          setNombreGimnasio(gymSnap.data().nombreGimnasio || "");
        }
      } catch (error) {
        // No mostramos el error en pantalla: el caso "doc no existe" o "permiso"
        // se maneja visualmente con el estado vacío.
        console.log("GymOwnerHome: no se pudo leer gimnasios/{uid}", error?.code || error?.message || error);
      } finally {
        setLoading(false);
      }
    };

    fetchGym();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  const hasInfo = nombreGimnasio.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>PANEL DEL GIMNASIO</Text>

      {hasInfo ? (
        <>
          <Text style={styles.title}>{nombreGimnasio}</Text>
          <Text style={styles.subtitle}>Bienvenido de nuevo</Text>
        </>
      ) : (
        <>
          <Text style={styles.titleMuted}>Completá tu información</Text>
          <Text style={styles.subtitle}>
            Cargá los datos del gimnasio desde el tab Perfil.
          </Text>
        </>
      )}

      <TouchableOpacity
        style={[styles.button, { marginBottom: 12 }]}
        onPress={() => navigation.navigate("ManageGymDetails")}
      >
        <Text style={styles.buttonText}>Detalles y fotos del gimnasio</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { marginBottom: 12 }]}
        onPress={() => navigation.navigate("ManageClasses")}
      >
        <Text style={styles.buttonText}>Clases</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("GymReservations")}
      >
        <Text style={styles.buttonText}>Reservas recibidas</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  eyebrow: {
    color: COLORS.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: COLORS.green,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  titleMuted: {
    color: COLORS.green,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
  },
  button: {
    backgroundColor: COLORS.greenDark,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 16,
  },
});
