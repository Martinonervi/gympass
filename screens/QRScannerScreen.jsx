import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const COLORS = {
  bg:       "#0f1520",
  card:     "#152030",
  green:    "#22c55e",
  greenDark:"#16a34a",
  border:   "#243244",
  text:     "#ffffff",
  textMuted:"#94a3b8",
  red:      "#ef4444",
};

export default function QRScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned,  setScanned]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  // result: null = scanning | { ok, titulo, detalle, extra }

  async function handleScan({ data }) {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      let qrData;
      try { qrData = JSON.parse(data); } catch {
        setResult({ ok: false, titulo: "QR no reconocido", detalle: "El código escaneado no es un QR de GymPass." });
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        setResult({ ok: false, titulo: "Error", detalle: "No hay usuario autenticado." });
        return;
      }

      if (!qrData.reservaId || !qrData.gymId) {
        setResult({ ok: false, titulo: "QR inválido", detalle: "El código no contiene datos de reserva." });
        return;
      }

      if (qrData.gymId !== user.uid) {
        setResult({ ok: false, titulo: "Gimnasio incorrecto", detalle: "Este QR pertenece a otro gimnasio." });
        return;
      }

      const snap = await getDoc(doc(db, "reservas", qrData.reservaId));

      if (!snap.exists() || snap.data().gymId !== user.uid) {
        setResult({ ok: false, titulo: "Reserva no encontrada", detalle: "No existe una reserva con este código." });
        return;
      }

      const reserva = snap.data();

      if (reserva.estado === "usado") {
        setResult({
          ok: false,
          titulo: "QR ya utilizado",
          detalle: "Este código ya fue escaneado anteriormente.",
          extra: reserva.emailUsuario || reserva.nombreUsuario || null,
        });
        return;
      }

      await updateDoc(doc(db, "reservas", qrData.reservaId), {
        estado: "usado",
        validadoEn: serverTimestamp(),
      });

      setResult({
        ok: true,
        titulo: "¡QR Válido!",
        detalle: reserva.tipo === "clase"
          ? `Clase: ${reserva.actividad || "Clase grupal"}`
          : "Pase libre",
        extra: reserva.emailUsuario || reserva.nombreUsuario || null,
      });
    } catch (e) {
      console.error("QR scan error:", e);
      setResult({ ok: false, titulo: "Error", detalle: e.message || "No se pudo validar. Intentá de nuevo." });
    } finally {
      setLoading(false);
    }
  }

  // ── Permission not yet determined ─────────────────────────────────────────
  if (!permission) {
    return <View style={styles.safe} />;
  }

  // ── Permission denied ─────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="camera-off-outline" size={52} color={COLORS.textMuted} />
          <Text style={styles.permTitle}>Acceso a la cámara</Text>
          <Text style={styles.permText}>
            Para escanear QR necesitás permitir el acceso a la cámara.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Permitir cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
            <Text style={{ color: COLORS.green, fontSize: 15 }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Result screen ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
            <Text style={styles.backText}>Volver</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Validar QR</Text>
        </View>

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

          <TouchableOpacity
            style={styles.scanAnotherBtn}
            onPress={() => { setResult(null); setScanned(false); }}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={18} color="#fff" />
            <Text style={styles.scanAnotherText}>Escanear otro</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Camera / scanning ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Validar QR</Text>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleScan}
        />

        {/* Overlay with scan frame */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanFrame}>
              {/* Corner decorations */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.scanHint}>
              {loading ? "Validando…" : "Apuntá al QR del usuario"}
            </Text>
            {loading && <ActivityIndicator color={COLORS.green} style={{ marginTop: 12 }} />}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const OVERLAY_COLOR = "rgba(0,0,0,0.55)";
const FRAME_SIZE    = 230;
const CORNER_SIZE   = 22;
const CORNER_WIDTH  = 4;

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },

  header:      { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12 },
  backBtn:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  backText:    { color: COLORS.green, fontSize: 15 },
  headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: "800" },

  // ── Camera
  cameraWrap: { flex: 1 },
  camera:     { flex: 1 },

  overlay:       { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  overlayTop:    { flex: 1, backgroundColor: OVERLAY_COLOR },
  overlayMiddle: { flexDirection: "row", height: FRAME_SIZE },
  overlaySide:   { flex: 1, backgroundColor: OVERLAY_COLOR },
  overlayBottom: {
    flex: 1, backgroundColor: OVERLAY_COLOR,
    alignItems: "center", paddingTop: 24,
  },

  scanFrame: {
    width: FRAME_SIZE, height: FRAME_SIZE,
    backgroundColor: "transparent",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderColor: COLORS.green,
  },
  cornerTL: { top: 0,  left: 0,  borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,  borderTopLeftRadius: 6 },
  cornerTR: { top: 0,  right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0,  borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,  borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderBottomRightRadius: 6 },

  scanHint: {
    color: "#fff", fontSize: 15, fontWeight: "600",
    textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // ── Result
  resultWrap: { flex: 1, padding: 22, justifyContent: "center", gap: 16 },
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

  scanAnotherBtn: {
    backgroundColor: COLORS.greenDark, borderRadius: 14,
    paddingVertical: 14, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  scanAnotherText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // ── Permissions
  permTitle:   { color: COLORS.text,    fontSize: 18, fontWeight: "700", textAlign: "center" },
  permText:    { color: COLORS.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  permBtn:     { backgroundColor: COLORS.greenDark, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  permBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
