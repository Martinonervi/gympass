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
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import * as WebBrowser from "expo-web-browser";
import { auth, db } from "../firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DismissKeyboard from "../components/DismissKeyboard";
import ScreenHeader from "../components/ScreenHeader";

const BACKEND_URL = "https://gympass-production.up.railway.app";

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
  Classic: 40000,
  Platinum: 60000,
  Black: 80000,
};

// Meses que se cobran según el período (anual = 10 meses, 2 de descuento).
const MESES_PERIODO = { mensual: 1, anual: 10 };

export default function EmployerPlanConfigScreen({ navigation }) {
  const [employeeCount, setEmployeeCount] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("Classic");
  const [periodo, setPeriodo] = useState("mensual"); // "mensual" | "anual"
  const [cuposUsados, setCuposUsados] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const precioMensual = employeeCount > 0 ? Number(employeeCount) * PLANES[selectedPlan] : 0;
  const budget = precioMensual * MESES_PERIODO[periodo];

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
        if (data.planPeriodo) {
          setPeriodo(data.planPeriodo);
        }
        setCuposUsados(data.cuposUsados || 0);
      }
    } catch (error) {
      console.log("Error cargando el plan actual:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Espera a que el webhook de MercadoPago marque el plan como pagado en Firestore.
  const esperarPagoEmpresa = async (uid, intentos = 10, delay = 2000) => {
    for (let i = 0; i < intentos; i++) {
      try {
        const snap = await getDoc(doc(db, "empleadores", uid));
        if (snap.exists() && snap.data().planPagado === true) return true;
      } catch (e) {
        console.log("esperarPagoEmpresa error:", e?.message);
      }
      if (i < intentos - 1) await new Promise((r) => setTimeout(r, delay));
    }
    return false;
  };

  const handleConfirmPlan = async () => {
    if (!employeeCount || Number(employeeCount) <= 0) {
      Alert.alert("Error", "Ingresá un número válido de empleados.");
      return;
    }

    const cantidad = Number(employeeCount);
    const planId = selectedPlan.toLowerCase(); // "classic" | "platinum" | "black"

    // No permitir un tope por debajo de los empleados ya cargados.
    if (cantidad < cuposUsados) {
      Alert.alert(
        "Cantidad insuficiente",
        `Ya tenés ${cuposUsados} empleados cargados. Para reducir el plan a ${cantidad}, primero dá de baja empleados desde Administrar Nómina.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const user = auth.currentUser;
      if (!user) throw new Error("No hay usuario autenticado.");

      const employerRef = doc(db, "empleadores", user.uid);

      // 1. Guardar la configuración elegida (todavía sin pagar).
      await setDoc(employerRef, {
        cuposTotales: cantidad,
        planTipo: selectedPlan,
        planPeriodo: periodo,
        presupuestoMensual: precioMensual,
        planPagado: false,
      }, { merge: true });

      // 2. Crear la preferencia de pago corporativo en el backend.
      const idToken = await user.getIdToken();
      const response = await fetch(`${BACKEND_URL}/crear-preferencia-empresa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ planId, cantidad, periodo }),
      });
      // Leemos como texto primero: si el backend devuelve HTML (p. ej. un 404
      // porque el endpoint no está deployado), evitamos el "JSON Parse error".
      const raw = await response.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          "El servidor de pagos no respondió correctamente. Verificá que el backend esté actualizado en Railway."
        );
      }
      if (!response.ok) throw new Error(data.error || "Error al crear preferencia");

      // 3. Abrir MercadoPago y esperar el retorno (deep link) tras pagar.
      const result = await WebBrowser.openAuthSessionAsync(data.initPoint, "gympass://payment");

      const marcarPagado = async () => {
        // Vencimiento: 1 mes (mensual) o 12 meses (anual) desde hoy.
        const vence = new Date();
        vence.setMonth(vence.getMonth() + (periodo === "anual" ? 12 : 1));
        await setDoc(
          employerRef,
          {
            planPagado: true,
            planPeriodo: periodo,
            planPagadoEn: serverTimestamp(),
            planVence: vence,
          },
          { merge: true }
        );
      };

      if (result.type === "success" && result.url) {
        const status = result.url.match(/[?&]status=([^&]+)/)?.[1];
        if (status === "approved") {
          await marcarPagado();
          Alert.alert("Pago confirmado", `Plan ${selectedPlan} corporativo activado para ${cantidad} empleados.`);
          navigation.goBack();
        } else if (status === "pending") {
          Alert.alert("Pago pendiente", "El pago quedó pendiente de acreditación.");
        } else {
          Alert.alert("Pago rechazado", "El pago no se completó. La configuración quedó guardada sin pagar.");
        }
      } else {
        // Cerró el checkout: el webhook pudo acreditar igual. Verificamos.
        const pagado = await esperarPagoEmpresa(user.uid);
        if (pagado) {
          Alert.alert("Pago confirmado", `Plan ${selectedPlan} corporativo activado para ${cantidad} empleados.`);
          navigation.goBack();
        } else {
          Alert.alert("Sin pago", "No se completó el pago. La configuración quedó guardada sin pagar.");
        }
      }
    } catch (error) {
      console.error("Error al configurar el plan:", error);
      Alert.alert("Error", "No se pudo procesar el pago. " + error.message);
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <DismissKeyboard>
       <View style={{ flex: 1 }}>
      <ScreenHeader title="Configurar Plan" onBack={() => navigation.goBack()} />

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

        {/* Selector de período */}
        <Text style={styles.inputLabel}>Período de facturación</Text>
        <View style={styles.planSelector}>
          {[
            { key: "mensual", label: "Mensual" },
            { key: "anual", label: "Anual (2 meses gratis)" },
          ].map((opt) => {
            const isSelected = periodo === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.planCard, isSelected && styles.planCardActive]}
                onPress={() => setPeriodo(opt.key)}
              >
                <Text style={[styles.planCardText, isSelected && styles.planCardTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.budgetCard}>
          <MaterialCommunityIcons name="calculator-variant-outline" size={28} color={COLORS.green} />
          <View style={styles.budgetInfo}>
            <Text style={styles.budgetLabel}>
              {periodo === "anual" ? "Total anual" : "Total mensual"}
            </Text>
            <Text style={styles.budgetValue}>
              {budget > 0 ? `$${budget.toLocaleString("es-AR")}` : "$0"}
            </Text>
            <Text style={styles.budgetDetail}>
              {periodo === "anual"
                ? `${MESES_PERIODO.anual} meses · equivale a $${precioMensual.toLocaleString("es-AR")}/mes`
                : `$${PLANES[selectedPlan].toLocaleString("es-AR")} por usuario/mes`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleConfirmPlan}
          disabled={isSubmitting}
        >
          <MaterialCommunityIcons name="credit-card-outline" size={20} color={COLORS.bg} />
          <Text style={styles.buttonText}>
            {isSubmitting
              ? "Procesando..."
              : budget > 0
                ? `Pagar $${budget.toLocaleString("es-AR")}`
                : "Guardar y pagar"}
          </Text>
        </TouchableOpacity>
      </View>
       </View>
      </DismissKeyboard>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex1: {
    flex: 1,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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