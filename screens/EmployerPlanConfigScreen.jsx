import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DismissKeyboard from "../components/DismissKeyboard";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  placeholder: "#475569",
};

const PLANES = {
  Classic: 5000,
  Platinum: 10000,
  Black: 20000,
};

export default function EmployerPlanConfigScreen({ navigation }) {
  const [employeeCount, setEmployeeCount] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("Classic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const budget = employeeCount > 0 ? Number(employeeCount) * PLANES[selectedPlan] : 0;

  useEffect(() => {
    fetchCurrentPlan();
  }, []);

  const fetchCurrentPlan = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const employerRef = doc(db, "empleadores", user.uid);
      const docSnap = await getDoc(employerRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.cuposTotales) {
          setEmployeeCount(data.cuposTotales.toString());
        }
        if (data.planTipo) {
          setSelectedPlan(data.planTipo);
        }
      }
    } catch (error) {
      console.log("Error cargando el plan actual:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPlan = async () => {
    if (!employeeCount || Number(employeeCount) <= 0) {
      Alert.alert("Error", "Ingresá un número válido de empleados.");
      return;
    }

    try {
      setIsSubmitting(true);
      const user = auth.currentUser;
      if (!user) throw new Error("No hay usuario autenticado.");

      const employerRef = doc(db, "empleadores", user.uid);

      await setDoc(employerRef, {
        cuposTotales: Number(employeeCount),
        planTipo: selectedPlan,
        presupuestoMensual: budget,
      }, { merge: true });

      Alert.alert("Éxito", `Plan ${selectedPlan} corporativo guardado correctamente.`);
      navigation.goBack();
    } catch (error) {
      console.error("Error al configurar el plan:", error);
      Alert.alert("Error", "No se pudo guardar la configuración. " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <DismissKeyboard>
       <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurar Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>PLAN CORPORATIVO</Text>
        <Text style={styles.title}>Definí tu beneficio</Text>
        <Text style={styles.subtitle}>
          Seleccioná la categoría y la cantidad de empleados que tendrán acceso.
        </Text>

        {/* Selector de Planes */}
        <Text style={styles.inputLabel}>Nivel del Plan</Text>
        <View style={styles.planSelector}>
          {Object.keys(PLANES).map((planKey) => {
            const isSelected = selectedPlan === planKey;
            return (
              <TouchableOpacity
                key={planKey}
                style={[styles.planCard, isSelected && styles.planCardActive]}
                onPress={() => setSelectedPlan(planKey)}
              >
                <Text style={[styles.planCardText, isSelected && styles.planCardTextActive]}>
                  {planKey}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Cantidad de Empleados</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 50"
            placeholderTextColor={COLORS.placeholder}
            keyboardType="numeric"
            value={employeeCount}
            onChangeText={setEmployeeCount}
          />
        </View>

        <View style={styles.budgetCard}>
          <MaterialCommunityIcons name="calculator-variant-outline" size={28} color={COLORS.green} />
          <View style={styles.budgetInfo}>
            <Text style={styles.budgetLabel}>Presupuesto Mensual</Text>
            <Text style={styles.budgetValue}>
              {budget > 0 ? `$${budget.toLocaleString("es-AR")}` : "$0"}
            </Text>
            <Text style={styles.budgetDetail}>
              (${PLANES[selectedPlan].toLocaleString("es-AR")} por usuario)
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleConfirmPlan}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? "Guardando..." : "Confirmar Configuración"}
          </Text>
        </TouchableOpacity>
      </View>
       </View>
      </DismissKeyboard>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 24,
  },
  eyebrow: {
    color: COLORS.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
    fontWeight: "600",
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  planSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  planCardActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  planCardText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  planCardTextActive: {
    color: COLORS.bg,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    color: COLORS.text,
    fontSize: 16,
  },
  budgetCard: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.2)",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 32,
  },
  budgetInfo: {
    flex: 1,
  },
  budgetLabel: {
    color: COLORS.green,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  budgetValue: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 4,
  },
  budgetDetail: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  button: {
    backgroundColor: COLORS.green,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: "auto",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.bg,
    fontSize: 16,
    fontWeight: "bold",
  },
});