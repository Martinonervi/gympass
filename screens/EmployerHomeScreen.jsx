import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { revisarVencimientoEmpleador } from "../utils/suscripcionEmpleador";

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
  const [suscripcion, setSuscripcion] = useState({ estado: "sin-plan", vence: null });

  useFocusEffect(
    useCallback(() => {
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

          // Revisar vencimiento de la suscripción (da de baja y notifica si venció)
          const estadoSub = await revisarVencimientoEmpleador(user.uid);
          setSuscripcion(estadoSub);
          if (estadoSub.estado === "vencio-ahora") {
            Alert.alert(
              "Plan vencido",
              "Tu suscripción corporativa venció. Renovala desde Configurar Plan Corporativo para seguir cargando empleados."
            );
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
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  const hasInfo = nombreEmpresa.trim().length > 0;

  const venceStr = suscripcion.vence
    ? suscripcion.vence.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

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

      {/* Estado de la suscripción */}
      {suscripcion.estado === "vigente" ? (
        <View style={[styles.subBanner, styles.subBannerOk]}>
          <MaterialCommunityIcons name="check-decagram-outline" size={18} color={COLORS.green} />
          <Text style={styles.subBannerOkText}>
            Plan activo{venceStr ? ` · vence el ${venceStr}` : ""}
          </Text>
        </View>
      ) : (
        <View style={[styles.subBanner, styles.subBannerWarn]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#f59e0b" />
          <Text style={styles.subBannerWarnText}>
            {suscripcion.estado === "vencio-ahora"
              ? "Tu plan venció. Renovalo para cargar empleados."
              : "Sin plan activo. Configurá y pagá tu plan corporativo."}
          </Text>
        </View>
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
  subBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: "100%",
    marginBottom: 20,
  },
  subBannerOk: {
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  subBannerOkText: {
    color: COLORS.green,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  subBannerWarn: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  subBannerWarnText: {
    color: "#f59e0b",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
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
