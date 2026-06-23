import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import DismissKeyboard from "../components/DismissKeyboard";
import ScreenHeader from "../components/ScreenHeader";

const COLORS = {
  bg:        "#0f1520",
  card:      "#152030",
  green:     "#22c55e",
  greenDark: "#16a34a",
  border:    "#243244",
  text:      "#ffffff",
  textMuted: "#94a3b8",
  red:       "#ef4444",
};

export default function CodeValidatorScreen({ navigation }) {
  const [codigo, setCodigo]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);

  async function handleValidar() {
    const trimmed = codigo.trim().toUpperCase();
    if (trimmed.length !== 8) {
      setResult({ ok: false, titulo: "Código inválido", detalle: "El código debe tener 8 caracteres." });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        setResult({ ok: false, titulo: "Error", detalle: "No hay usuario autenticado." });
        return;
      }

      const snap = await getDocs(
        query(collection(db, "reservas"), where("gymId", "==", user.uid))
      );

      const match = snap.docs.find(
        (d) => d.id.slice(-8).toUpperCase() === trimmed
      );

      if (!match) {
        setResult({ ok: false, titulo: "Código no encontrado", detalle: "No existe una reserva con ese código en este gimnasio." });
        return;
      }

      const reserva = match.data();

      if (reserva.estado === "usado") {
        setResult({
          ok: false,
          titulo: "Código ya utilizado",
          detalle: "Esta reserva ya fue validada anteriormente.",
          extra: reserva.emailUsuario || reserva.nombreUsuario || null,
        });
        return;
      }

      // La ganancia del gym se calcula a partir de las reservas validadas
      // (validadoEn); solo marcamos la reserva como usada.
      await updateDoc(doc(db, "reservas", match.id), {
        estado: "usado",
        validadoEn: serverTimestamp(),
      });

      setResult({
        ok: true,
        titulo: "¡Código válido!",
        detalle: reserva.tipo === "clase"
          ? `Clase: ${reserva.actividad || "Clase grupal"}`
          : "Pase libre",
        extra: reserva.emailUsuario || reserva.nombreUsuario || null,
      });
    } catch (e) {
      console.error("Code validation error:", e);
      setResult({ ok: false, titulo: "Error", detalle: e.message || "No se pudo validar. Intentá de nuevo." });
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setCodigo("");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <DismissKeyboard>
        <View style={{ flex: 1 }}>
        <ScreenHeader title="Validar código" onBack={() => navigation.goBack()} />

        <View style={styles.body}>
          {result ? (
            <View style={styles.resultWrap}>
              <View style={[styles.resultCard, result.ok ? styles.resultOk : styles.resultErr]}>
                <MaterialCommunityIcons
                  name={result.ok ? "check-circle-outline" : "close-circle-outline"}
                  size={64}
                  color={result.ok ? COLORS.green : COLORS.red}
                />
                <Text style={[styles.resultTitulo, { color: result.ok ? COLORS.green : COLORS.red }]}>
                  {result.titulo}
                </Text>
                <Text style={styles.resultDetalle}>{result.detalle}</Text>
                {!!result.extra && (
                  <View style={styles.resultUserRow}>
                    <MaterialCommunityIcons name="account-outline" size={15} color={COLORS.textMuted} />
                    <Text style={styles.resultUser}>{result.extra}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleReset}>
                <MaterialCommunityIcons name="keyboard-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Validar otro código</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formWrap}>
              <MaterialCommunityIcons name="shield-key-outline" size={56} color={COLORS.green} style={{ marginBottom: 20 }} />
              <Text style={styles.formTitle}>Ingresá el código de acceso</Text>
              <Text style={styles.formSub}>
                Es el código de 8 caracteres que aparece en el comprobante del usuario.
              </Text>

              <TextInput
                style={styles.input}
                value={codigo}
                onChangeText={(t) => setCodigo(t.toUpperCase())}
                placeholder="Ej: A1B2C3D4"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
                maxLength={8}
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, (!codigo.trim() || loading) && styles.primaryBtnDisabled]}
                onPress={handleValidar}
                disabled={!codigo.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-bold" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Validar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
        </View>
        </DismissKeyboard>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },

  header:      { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12 },
  backBtn:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  backText:    { color: COLORS.green, fontSize: 15 },
  headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: "800" },

  body: { flex: 1, padding: 22 },

  formWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  formTitle: { color: COLORS.text, fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  formSub:   { color: COLORS.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 28 },

  input: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: 16,
  },

  primaryBtn: {
    backgroundColor: COLORS.greenDark,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  resultWrap: { flex: 1, justifyContent: "center", gap: 16 },
  resultCard: {
    borderRadius: 20, padding: 30,
    alignItems: "center", gap: 10,
    borderWidth: 1,
  },
  resultOk:      { backgroundColor: "#0a1f0e", borderColor: COLORS.green },
  resultErr:     { backgroundColor: "#1f0a0a", borderColor: COLORS.red },
  resultTitulo:  { fontSize: 22, fontWeight: "800" },
  resultDetalle: { color: COLORS.textMuted, fontSize: 15, textAlign: "center", lineHeight: 21 },
  resultUserRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  resultUser:    { color: COLORS.text, fontSize: 14, fontWeight: "600" },
});
