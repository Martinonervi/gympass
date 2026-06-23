import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  collection, addDoc, serverTimestamp,
  doc, getDoc, updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import ScreenHeader from "../components/ScreenHeader";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  greenDark: "#16a34a",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  input: "#111827",
  error: "#ef4444",
};

const DIAS = [
  { key: "lunes",     short: "Lu" },
  { key: "martes",    short: "Ma" },
  { key: "miercoles", short: "Mi" },
  { key: "jueves",    short: "Ju" },
  { key: "viernes",   short: "Vi" },
  { key: "sabado",    short: "Sá" },
  { key: "domingo",   short: "Do" },
];

const DIA_LABELS = {
  lunes: "Lunes", martes: "Martes", miercoles: "Miércoles",
  jueves: "Jueves", viernes: "Viernes", sabado: "Sábado", domingo: "Domingo",
};

function horaStringADate(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateAHoraString(date) {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function calcDuracion(inicio, fin) {
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fin.split(":").map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

function horaToMins(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + m;
}

function minsToHora(mins) {
  return `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`;
}

// ─── Snackbar ────────────────────────────────────────────────────────────────
function Snackbar({ message, type = "error", visible }) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 100, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const isSuccess = type === "success";
  return (
    <Animated.View
      style={[styles.snackbar, isSuccess ? styles.snackbarSuccess : styles.snackbarError, { transform: [{ translateY }], opacity }]}
      pointerEvents="none"
    >
      <Text style={styles.snackbarIcon}>{isSuccess ? "✓" : "✕"}</Text>
      <Text style={styles.snackbarText}>{message}</Text>
    </Animated.View>
  );
}

function useSnackbar() {
  const [snackbar, setSnackbar] = useState({ visible: false, message: "", type: "error" });
  const timerRef = useRef(null);
  function showSnackbar(message, type = "error", duration = 3500) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSnackbar({ visible: true, message, type });
    timerRef.current = setTimeout(() => setSnackbar((p) => ({ ...p, visible: false })), duration);
  }
  return { snackbar, showSnackbar };
}

// ─── AddClassScreen ──────────────────────────────────────────────────────────
export default function AddClassScreen({ route, navigation }) {
  const claseId = route?.params?.claseId || null;
  const isEditMode = !!claseId;

  const [loadingGym, setLoadingGym] = useState(true);
  const [saving, setSaving] = useState(false);
  const { snackbar, showSnackbar } = useSnackbar();

  const [gymActividades, setGymActividades] = useState([]);
  const [gymHorarios, setGymHorarios] = useState({});
  const [closedDias, setClosedDias] = useState([]);
  const [actividad, setActividad] = useState("");
  const [dia, setDia] = useState("");
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFin, setHoraFin] = useState("09:00");
  const [cupo, setCupo] = useState("");
  const [profesor, setProfesor] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [picker, setPicker] = useState({ visible: false, campo: null });
  const [tempHora, setTempHora] = useState(new Date());

  useEffect(() => {
    async function fetchData() {
      const user = auth.currentUser;
      if (!user) { setLoadingGym(false); return; }
      try {
        const gymSnap = await getDoc(doc(db, "gimnasios", user.uid));
        if (gymSnap.exists()) {
          const gymData = gymSnap.data();
          setGymActividades(gymData.actividades || []);
          const horarios = gymData.horarios || {};
          setGymHorarios(horarios);
          setClosedDias(DIAS.map((d) => d.key).filter((d) => horarios[d]?.abierto === false));
        }

        if (isEditMode) {
          const claseSnap = await getDoc(doc(db, "gimnasios", user.uid, "clases", claseId));
          if (claseSnap.exists()) {
            const cls = claseSnap.data();
            setActividad(cls.actividad || "");
            setDia(cls.dia || "");
            setHoraInicio(cls.horaInicio || "08:00");
            setHoraFin(cls.horaFin || "09:00");
            setCupo(cls.cupo ? String(cls.cupo) : "");
            setProfesor(cls.profesor || "");
            setDescripcion(cls.descripcion || "");
          }
        }
      } catch (e) {
        console.error("Error fetching data:", e);
      } finally {
        setLoadingGym(false);
      }
    }
    fetchData();
  }, []);

  function abrirPicker(campo) {
    setTempHora(horaStringADate(campo === "inicio" ? horaInicio : horaFin));
    setPicker({ visible: true, campo });
  }

  function aplicarHoraPicker(campo, horaStr) {
    const newMins = horaToMins(horaStr);
    const diaHorario = gymHorarios[dia];
    const gymAbreMins   = diaHorario?.abierto ? horaToMins(diaHorario.abre)   : 0;
    const gymCierraMins = diaHorario?.abierto ? horaToMins(diaHorario.cierra) : 23 * 60 + 59;

    if (campo === "inicio") {
      const finMins = horaToMins(horaFin);
      if (newMins >= finMins) {
        // Auto-adjust fin = inicio + 60 min
        const newFinMins = newMins + 60;
        if (newFinMins > 23 * 60 + 59) {
          showSnackbar("La hora de inicio es demasiado tarde para agregar una clase.");
          return false;
        }
        if (diaHorario?.abierto && (newMins < gymAbreMins || newFinMins > gymCierraMins)) {
          showSnackbar(`La clase debe estar dentro del horario del gimnasio: ${diaHorario.abre} - ${diaHorario.cierra}`);
          return false;
        }
        setHoraInicio(horaStr);
        setHoraFin(minsToHora(newFinMins));
      } else {
        if (diaHorario?.abierto && newMins < gymAbreMins) {
          showSnackbar(`El inicio no puede ser antes de la apertura del gimnasio: ${diaHorario.abre}`);
          return false;
        }
        setHoraInicio(horaStr);
      }
    } else { // campo === "fin"
      if (newMins === 0) {
        showSnackbar("La hora de fin no puede ser las 00:00.");
        return false;
      }
      const inicioMins = horaToMins(horaInicio);
      if (newMins <= inicioMins) {
        // Auto-adjust inicio = fin - 60 min
        const newInicioMins = newMins - 60;
        if (newInicioMins < 0) {
          showSnackbar("La hora de fin es demasiado temprana.");
          return false;
        }
        if (diaHorario?.abierto && (newInicioMins < gymAbreMins || newMins > gymCierraMins)) {
          showSnackbar(`La clase debe estar dentro del horario del gimnasio: ${diaHorario.abre} - ${diaHorario.cierra}`);
          return false;
        }
        setHoraInicio(minsToHora(newInicioMins));
        setHoraFin(horaStr);
      } else {
        if (diaHorario?.abierto && newMins > gymCierraMins) {
          showSnackbar(`El fin no puede ser después del cierre del gimnasio: ${diaHorario.cierra}`);
          return false;
        }
        setHoraFin(horaStr);
      }
    }
    return true;
  }

  function onPickerChange(event, selectedDate) {
    if (!selectedDate) return;
    if (Platform.OS === "android") {
      const campo = picker.campo;
      setPicker((p) => ({ ...p, visible: false }));
      if (event.type === "dismissed") return;
      aplicarHoraPicker(campo, dateAHoraString(selectedDate));
    } else {
      setTempHora(selectedDate);
    }
  }

  function confirmarHoraIOS() {
    aplicarHoraPicker(picker.campo, dateAHoraString(tempHora));
    setPicker((p) => ({ ...p, visible: false }));
  }

  async function handleSave() {
    const user = auth.currentUser;
    if (!user) { showSnackbar("No hay un usuario autenticado."); return; }
    if (!actividad) { showSnackbar("Seleccioná una actividad."); return; }
    if (!dia) { showSnackbar("Seleccioná el día de la clase."); return; }
    const duracion = calcDuracion(horaInicio, horaFin);
    if (duracion <= 0) { showSnackbar("La hora de fin debe ser después de la de inicio."); return; }

    const diaHorario = gymHorarios[dia];
    if (diaHorario?.abierto) {
      if (horaInicio < diaHorario.abre || horaFin > diaHorario.cierra) {
        showSnackbar(`La clase debe estar dentro del horario del gimnasio: ${diaHorario.abre} - ${diaHorario.cierra}`);
        return;
      }
    }

    if (!cupo.trim()) { showSnackbar("El cupo es obligatorio."); return; }
    const cupoNum = parseInt(cupo.trim(), 10);
    if (isNaN(cupoNum) || cupoNum <= 0) {
      showSnackbar("El cupo debe ser un número positivo.");
      return;
    }

    const payload = {
      actividad,
      dia,
      horaInicio,
      horaFin,
      duracion,
      diaHora: `${DIA_LABELS[dia]} ${horaInicio} - ${horaFin}`,
      cupo: cupoNum,
      profesor: profesor.trim(),
      descripcion: descripcion.trim(),
    };

    setSaving(true);
    try {
      const user2 = auth.currentUser;
      if (isEditMode) {
        await updateDoc(doc(db, "gimnasios", user2.uid, "clases", claseId), payload);
      } else {
        await addDoc(collection(db, "gimnasios", user2.uid, "clases"), {
          ...payload,
          creadoEn: serverTimestamp(),
        });
      }
      showSnackbar(isEditMode ? "Clase actualizada." : "Clase agregada.", "success");
      setTimeout(() => navigation.goBack(), 800);
    } catch (error) {
      console.log("AddClass error:", error?.code || error?.message || error);
      showSnackbar(
        error?.code === "permission-denied"
          ? "No tenés permisos para guardar. Revisá las reglas de Firestore."
          : "No se pudo guardar la clase."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingGym) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </SafeAreaView>
    );
  }

  if (gymActividades.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ScreenHeader title={isEditMode ? "Editar clase" : "Agregar clase"} onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="dumbbell" size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>Sin actividades cargadas</Text>
            <Text style={styles.emptyText}>
              Para agregar clases, primero seleccioná las actividades que ofrece tu gimnasio en{" "}
              <Text style={{ color: COLORS.green, fontWeight: "700" }}>Detalles del Gimnasio</Text>.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.goBack()}>
              <Text style={styles.emptyButtonText}>Ir a Detalles del Gimnasio</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const duracionPreview = calcDuracion(horaInicio, horaFin);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScreenHeader title={isEditMode ? "Editar clase" : "Agregar clase"} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={styles.subtitle}>
          {isEditMode ? "Modificá los detalles de la clase." : "Configurá los detalles de la nueva clase."}
        </Text>

        {isEditMode && (
          <View style={styles.editNotice}>
            <MaterialCommunityIcons name="information-outline" size={15} color={COLORS.green} />
            <Text style={styles.editNoticeText}>
              En modo edición solo podés modificar el profesor y la descripción.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          {/* Actividad */}
          <Text style={styles.sectionTitle}>Actividad *</Text>
          <Text style={styles.sectionHint}>Seleccioná la actividad que corresponde a esta clase.</Text>
          <View style={styles.chipsWrap}>
            {gymActividades.map((act) => (
              <TouchableOpacity
                key={act}
                style={[styles.chip, actividad === act && styles.chipActive, isEditMode && styles.chipReadOnly]}
                onPress={() => { if (!isEditMode) setActividad(act); }}
                disabled={isEditMode}
              >
                <Text style={[styles.chipText, actividad === act && styles.chipTextActive]}>{act}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Día */}
          <Text style={styles.sectionTitle}>Día *</Text>
          <View style={styles.diasRow}>
            {DIAS.map(({ key, short }) => {
              const isClosed = closedDias.includes(key);
              const isSelected = dia === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.diaChip,
                    isSelected && styles.diaChipActive,
                    (isClosed || isEditMode) && styles.diaChipDisabled,
                  ]}
                  onPress={() => { if (!isClosed && !isEditMode) setDia(key); }}
                  disabled={isClosed || isEditMode}
                >
                  <Text style={[
                    styles.diaChipText,
                    isSelected && styles.diaChipTextActive,
                    (isClosed || isEditMode) && styles.diaChipTextDisabled,
                  ]}>
                    {short}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!isEditMode && closedDias.length > 0 && (
            <Text style={styles.closedHint}>Los días atenuados están marcados como cerrados en tu gimnasio.</Text>
          )}

          {/* Horario */}
          <Text style={styles.sectionTitle}>Horario *</Text>
          <View style={styles.horariosRow}>
            <View style={styles.horaBlock}>
              <Text style={styles.horaLabel}>Inicio</Text>
              <TouchableOpacity
                style={[styles.horaPicker, isEditMode && styles.horaPickerReadOnly]}
                onPress={() => { if (!isEditMode) abrirPicker("inicio"); }}
                disabled={isEditMode}
              >
                <Text style={styles.horaText}>{horaInicio}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.horaSepBlock}>
              <Text style={styles.horaSep}>—</Text>
            </View>
            <View style={styles.horaBlock}>
              <Text style={styles.horaLabel}>Fin</Text>
              <TouchableOpacity
                style={[styles.horaPicker, isEditMode && styles.horaPickerReadOnly]}
                onPress={() => { if (!isEditMode) abrirPicker("fin"); }}
                disabled={isEditMode}
              >
                <Text style={styles.horaText}>{horaFin}</Text>
              </TouchableOpacity>
            </View>
            {duracionPreview > 0 && (
              <View style={styles.duracionBadge}>
                <MaterialCommunityIcons name="timer-outline" size={12} color={COLORS.green} />
                <Text style={styles.duracionText}>{duracionPreview} min</Text>
              </View>
            )}
          </View>

          {/* Cupo */}
          <Text style={styles.sectionTitle}>Cupo *</Text>
          <TextInput
            style={[styles.input, isEditMode && styles.inputReadOnly]}
            placeholder="Ej: 15"
            placeholderTextColor={COLORS.textMuted}
            value={cupo}
            onChangeText={(t) => { if (!isEditMode) setCupo(t.replace(/\D/g, "")); }}
            keyboardType="numeric"
            editable={!isEditMode}
          />

          {/* Profesor */}
          <Text style={styles.sectionTitle}>Profesor</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre del profesor"
            placeholderTextColor={COLORS.textMuted}
            value={profesor}
            onChangeText={setProfesor}
          />

          {/* Descripción */}
          <Text style={styles.sectionTitle}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Detalles de la clase (opcional)"
            placeholderTextColor={COLORS.textMuted}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                {isEditMode ? "Guardar cambios" : "Agregar clase"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Picker de hora */}
      {Platform.OS === "ios" ? (
        <Modal visible={picker.visible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setPicker((p) => ({ ...p, visible: false }))}>
                  <Text style={styles.modalCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmarHoraIOS}>
                  <Text style={styles.modalConfirm}>Aceptar</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                mode="time"
                display="spinner"
                value={tempHora}
                onChange={onPickerChange}
                is24Hour={true}
                style={styles.iosPicker}
                textColor={COLORS.text}
              />
            </View>
          </View>
        </Modal>
      ) : (
        picker.visible && (
          <DateTimePicker
            mode="time"
            display="default"
            value={tempHora}
            onChange={onPickerChange}
            is24Hour={true}
          />
        )
      )}

      <Snackbar message={snackbar.message} type={snackbar.type} visible={snackbar.visible} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 22, paddingBottom: 40 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24, alignSelf: "flex-start" },
  back: { color: COLORS.green, fontSize: 15 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: COLORS.textMuted, marginTop: 6, marginBottom: 22 },
  card: { backgroundColor: COLORS.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: COLORS.border },

  sectionTitle: { color: COLORS.green, fontSize: 15, fontWeight: "700", marginTop: 18, marginBottom: 6 },
  sectionHint: { color: COLORS.textMuted, fontSize: 12, marginBottom: 10 },
  closedHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 6, fontStyle: "italic" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.input,
  },
  chipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  chipText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: COLORS.bg, fontWeight: "700" },

  diasRow: { flexDirection: "row", gap: 5 },
  diaChip: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.input,
  },
  diaChipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  diaChipDisabled: { opacity: 0.25 },
  diaChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  diaChipTextActive: { color: COLORS.bg, fontWeight: "700" },
  diaChipTextDisabled: { color: COLORS.textMuted },

  horariosRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  horaBlock: { alignItems: "center", gap: 6 },
  horaLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  horaSepBlock: { paddingBottom: 14 },
  horaSep: { color: COLORS.textMuted, fontSize: 18 },
  horaPicker: {
    backgroundColor: COLORS.input, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  horaText: { color: COLORS.green, fontSize: 18, fontWeight: "700" },
  duracionBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#0a1f0e", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.greenDark,
    marginBottom: 2,
  },
  duracionText: { color: COLORS.green, fontSize: 12, fontWeight: "600" },

  input: {
    backgroundColor: COLORS.input, color: COLORS.text,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: COLORS.border,
  },
  textarea: { minHeight: 80, textAlignVertical: "top" },

  button: { backgroundColor: COLORS.greenDark, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },

  editNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#0a1f0e", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.greenDark,
    marginBottom: 8,
  },
  editNoticeText: { color: COLORS.green, fontSize: 13, flex: 1, lineHeight: 18 },
  chipReadOnly: { opacity: 0.55 },
  horaPickerReadOnly: { opacity: 0.55 },
  inputReadOnly: { opacity: 0.55 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 16, paddingHorizontal: 20 },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyText: { color: COLORS.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  emptyButton: { backgroundColor: COLORS.greenDark, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, marginTop: 8 },
  emptyButtonText: { color: COLORS.text, fontSize: 15, fontWeight: "700" },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalCard: { backgroundColor: "#1a2535", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalCancel: { color: COLORS.textMuted, fontSize: 16 },
  modalConfirm: { color: COLORS.green, fontSize: 16, fontWeight: "700" },
  iosPicker: { backgroundColor: "#1a2535" },

  snackbar: { position: "absolute", bottom: 30, left: 20, right: 20, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  snackbarError: { backgroundColor: "#1f0a0a", borderWidth: 1, borderColor: COLORS.error },
  snackbarSuccess: { backgroundColor: "#0a1f0e", borderWidth: 1, borderColor: COLORS.green },
  snackbarIcon: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  snackbarText: { color: COLORS.text, fontSize: 14, flex: 1, lineHeight: 20 },
});
