import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const COLORS = {
  bg: "#0f1520",
  green: "#22c55e",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  placeholder: "#475569",
};

export default function EmployerHomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [nombreEmpresa, setNombreEmpresa] = useState("");

  useEffect(() => {
    const fetchEmpresa = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const empSnap = await getDoc(doc(db, "empleadores", user.uid));
        if (empSnap.exists()) {
          setNombreEmpresa(empSnap.data().nombreEmpresa || "");
        }
      } catch (error) {
        // No mostramos el error en pantalla: el caso "doc no existe" o "permiso"
        // se maneja visualmente con el estado vacío.
        console.log("EmployerHome: no se pudo leer empleadores/{uid}", error?.code || error?.message || error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresa();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  const hasInfo = nombreEmpresa.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>PANEL DEL EMPLEADOR</Text>

      {hasInfo ? (
        <>
          <Text style={styles.title}>{nombreEmpresa}</Text>
          <Text style={styles.subtitle}>Próximamente más funciones</Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>Completá tu información</Text>
          <Text style={styles.subtitle}>
            Cargá los datos de la empresa desde el tab Perfil.
          </Text>
        </>
      )}

      <TouchableOpacity
        style={styles.configButton}
        onPress={() => navigation.navigate("EmployerPlanConfig")}
      >
        <MaterialCommunityIcons
          name="domain"
          size={28}
          color={COLORS.green}
        />
        <Text style={styles.configButtonText}>Configurar Plan Corporativo</Text>
      </TouchableOpacity>

      <View style={{ height: 16 }} />

      <TouchableOpacity
        style={styles.manageButton}
        onPress={() => navigation.navigate("EmployerManageEmployees")}
      >
        <MaterialCommunityIcons
          name="account-group-outline"
          size={28}
          color={COLORS.text}
        />
        <Text style={styles.manageButtonText}>Administrar Nómina</Text>
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
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
  },
  configButton: {
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 18,
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  configButtonText: {
    color: COLORS.green,
    fontSize: 14,
    fontWeight: "bold",
  },
  manageButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "transparent",
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 18,
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  manageButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "bold",
  },
});
