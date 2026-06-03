import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Switch,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, addDoc, query, where, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import * as ImagePicker from "expo-image-picker";
import { CLOUDINARY } from "../cloudinaryConfig";

const uploadToCloudinary = async (uri, userId, index) => {
  const formData = new FormData();
  formData.append("file", { uri, type: "image/jpeg", name: `gym_${userId}_${index}_${Date.now()}.jpg` });
  formData.append("upload_preset", CLOUDINARY.uploadPreset);
  formData.append("folder", `gimnasios/${userId}`);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("Error al subir imagen a Cloudinary");
  return (await res.json()).secure_url;
};

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  greenDark: "#16a34a",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  input: "#111827",
  red: "#ef4444",
};

const DIAS = [
  { key: "lunes",     label: "Lunes" },
  { key: "martes",    label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves",    label: "Jueves" },
  { key: "viernes",   label: "Viernes" },
  { key: "sabado",    label: "Sábado" },
  { key: "domingo",   label: "Domingo" },
];

const HORARIOS_DEFAULT = {
  lunes:     { abre: "08:00", cierra: "22:00", abierto: true },
  martes:    { abre: "08:00", cierra: "22:00", abierto: true },
  miercoles: { abre: "08:00", cierra: "22:00", abierto: true },
  jueves:    { abre: "08:00", cierra: "22:00", abierto: true },
  viernes:   { abre: "08:00", cierra: "22:00", abierto: true },
  sabado:    { abre: "09:00", cierra: "14:00", abierto: true },
  domingo:   { abre: "00:00", cierra: "00:00", abierto: false },
};

export const ACTIVIDADES_PRESET = [
  "Musculación", "Spinning", "Yoga", "Pilates", "Funcional",
  "Natación", "Stretching", "Crossfit", "Boxeo", "Zumba",
];

const COMODIDADES_PRESET = [
  "Duchas", "WiFi", "Lockers", "Estacionamiento", "Vestuarios", "Cafetería",
];

const PLANES_GIMNASIO = [
  { id: "classic",  nombre: "Classic",  color: "#64748b" },
  { id: "platinum", nombre: "Platinum", color: "#8b5cf6" },
  { id: "black",    nombre: "Black",    color: "#f59e0b" },
];

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

function horaToMins(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + m;
}

function minsToHora(mins) {
  return `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`;
}

export default function ManageGymDetailsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [descripcion, setDescripcion] = useState("");
  const [horarios, setHorarios] = useState(HORARIOS_DEFAULT);
  const [actividades, setActividades] = useState([]);
  const [comodidades, setComodidades] = useState([]);
  const [otraActividad, setOtraActividad] = useState("");
  const [planGimnasio, setPlanGimnasio] = useState("classic");
  const [fotos, setFotos] = useState([]);
  const [clases, setClases] = useState([]);

  const [picker, setPicker] = useState({ visible: false, dia: null, campo: null });
  const [tempHora, setTempHora] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }
        const snap = await getDoc(doc(db, "gimnasios", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setDescripcion(data.descripcion || "");
          setActividades(data.actividades || []);
          setComodidades(Array.isArray(data.comodidades) ? data.comodidades : []);
          setPlanGimnasio(data.planGimnasio || "classic");
          setFotos(data.fotos || []);
          if (data.horarios && typeof data.horarios === "object" && Object.keys(data.horarios).length > 0) {
            setHorarios({ ...HORARIOS_DEFAULT, ...data.horarios });
          }
        }
        // Load existing classes to detect cascade deletes when an activity is removed
        const clasesSnap = await getDocs(collection(db, "gimnasios", user.uid, "clases"));
        setClases(clasesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        Alert.alert("Error", "Hubo un problema al cargar los datos.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  function abrirPicker(dia, campo) {
    const horaActual = horarios[dia]?.[campo] || "08:00";
    setTempHora(horaStringADate(horaActual));
    setPicker({ visible: true, dia, campo });
  }

  function aplicarHora(dia, campo, horaStr) {
    const newMins    = horaToMins(horaStr);
    const abreMins   = horaToMins(horarios[dia].abre);
    const cierraMins = horaToMins(horarios[dia].cierra);

    if (campo === "abre") {
      if (newMins >= cierraMins) {
        // Auto-adjust cierra = abre + 60 min
        const newCierraMins = newMins + 60;
        if (newCierraMins > 23 * 60 + 59) {
          Alert.alert("Horario inválido", "La hora de apertura es demasiado tarde.");
          return false;
        }
        setHorarios((prev) => ({
          ...prev,
          [dia]: { ...prev[dia], abre: horaStr, cierra: minsToHora(newCierraMins) },
        }));
      } else {
        setHorarios((prev) => ({
          ...prev,
          [dia]: { ...prev[dia], abre: horaStr },
        }));
      }
    } else { // cierra
      if (newMins === 0) {
        Alert.alert("Horario inválido", "El cierre no puede ser las 00:00.");
        return false;
      }
      if (newMins <= abreMins) {
        // Auto-adjust abre = cierra - 60 min
        const newAbreMins = newMins - 60;
        if (newAbreMins < 0) {
          Alert.alert("Horario inválido", "La hora de cierre es demasiado temprana.");
          return false;
        }
        setHorarios((prev) => ({
          ...prev,
          [dia]: { ...prev[dia], abre: minsToHora(newAbreMins), cierra: horaStr },
        }));
      } else {
        setHorarios((prev) => ({
          ...prev,
          [dia]: { ...prev[dia], cierra: horaStr },
        }));
      }
    }
    return true;
  }

  function onPickerChange(event, selectedDate) {
    if (!selectedDate) return;
    if (Platform.OS === "android") {
      setPicker((p) => ({ ...p, visible: false }));
      if (event.type === "dismissed") return;
      aplicarHora(picker.dia, picker.campo, dateAHoraString(selectedDate));
    } else {
      setTempHora(selectedDate);
    }
  }

  function confirmarHoraIOS() {
    aplicarHora(picker.dia, picker.campo, dateAHoraString(tempHora));
    setPicker((p) => ({ ...p, visible: false }));
  }

  function cancelarPickerIOS() {
    setPicker((p) => ({ ...p, visible: false }));
  }

  function toggleDia(dia) {
    setHorarios((prev) => ({ ...prev, [dia]: { ...prev[dia], abierto: !prev[dia].abierto } }));
  }

  async function cascadeDeleteClases(claseIds) {
    const user = auth.currentUser;
    if (!user || claseIds.length === 0) return;
    const promises = [];
    for (const claseId of claseIds) {
      promises.push(deleteDoc(doc(db, "gimnasios", user.uid, "clases", claseId)));
      const resSnap = await getDocs(query(
        collection(db, "reservas"),
        where("claseId", "==", claseId),
        where("gymId", "==", user.uid)
      ));
      const clase = clases.find((c) => c.id === claseId);
      const nombreClase = clase?.actividad || clase?.nombre || "la clase";
      const horario = clase?.diaHora || "";
      for (const d of resSnap.docs) {
        promises.push(deleteDoc(doc(db, "reservas", d.id)));
        const { userId } = d.data();
        if (userId) {
          promises.push(addDoc(
            collection(db, "usuarios", userId, "notificaciones"),
            {
              tipo: "clase_cancelada",
              titulo: "Clase cancelada",
              mensaje: `La clase de ${nombreClase}${horario ? ` (${horario})` : ""} fue cancelada por el gimnasio.`,
              leida: false,
              creadoEn: serverTimestamp(),
            }
          ));
        }
      }
    }
    await Promise.all(promises);
    setClases((prev) => prev.filter((c) => !claseIds.includes(c.id)));
  }

  function toggleActividad(act) {
    if (actividades.includes(act)) {
      // Removing — check if any existing classes use this activity
      const afectadas = clases.filter((c) => (c.actividad || c.nombre) === act);
      if (afectadas.length > 0) {
        Alert.alert(
          "Eliminar actividad",
          `Hay ${afectadas.length} clase${afectadas.length !== 1 ? "s" : ""} de "${act}". Al eliminar la actividad se borrarán esas clases y todas sus reservas. ¿Querés continuar?`,
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Eliminar",
              style: "destructive",
              onPress: async () => {
                setActividades((prev) => prev.filter((a) => a !== act));
                await cascadeDeleteClases(afectadas.map((c) => c.id));
              },
            },
          ]
        );
        return;
      }
      setActividades((prev) => prev.filter((a) => a !== act));
    } else {
      setActividades((prev) => [...prev, act]);
    }
  }

  function toggleComodidad(com) {
    setComodidades((prev) => prev.includes(com) ? prev.filter((c) => c !== com) : [...prev, com]);
  }

  function agregarOtraActividad() {
    const trimmed = otraActividad.trim();
    if (!trimmed) return;
    if (!actividades.includes(trimmed)) {
      setActividades((prev) => [...prev, trimmed]);
    }
    setOtraActividad("");
  }

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permiso denegado", "Se requiere permiso para acceder a la galería.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setFotos((prev) => [...prev, result.assets[0].uri]);
  };

  const handleRemovePhoto = (index) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const user = auth.currentUser;
      if (!user) throw new Error("No hay usuario autenticado.");

      const fotosSubidas = await Promise.all(
        fotos.map((uri, index) => {
          if (uri.startsWith("https://res.cloudinary.com")) return uri;
          return uploadToCloudinary(uri, user.uid, index);
        })
      );

      await setDoc(doc(db, "gimnasios", user.uid), {
        descripcion: descripcion.trim(),
        horarios,
        actividades,
        comodidades,
        planGimnasio,
        fotos: fotosSubidas,
      }, { merge: true });

      Alert.alert("Éxito", "Los detalles del gimnasio se actualizaron correctamente.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "No se pudieron guardar los detalles.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.green} /></View>
      </SafeAreaView>
    );
  }

  const actividadesCustom = actividades.filter((a) => !ACTIVIDADES_PRESET.includes(a));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.back}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Detalles del Gimnasio</Text>
        <Text style={styles.subtitle}>Agregá fotos, descripción y actividades a tu perfil público.</Text>

        <View style={styles.card}>
          {/* Descripción */}
          <Text style={styles.label}>Descripción del gimnasio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Contanos sobre tu gimnasio..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Horarios */}
          <Text style={styles.sectionTitle}>Horarios de atención</Text>
          {DIAS.map(({ key, label }) => {
            const dia = horarios[key];
            return (
              <View key={key} style={styles.diaRow}>
                <View style={styles.diaLeft}>
                  <Switch
                    value={dia.abierto}
                    onValueChange={() => toggleDia(key)}
                    trackColor={{ false: COLORS.border, true: COLORS.greenDark }}
                  />
                  <Text style={[styles.diaLabel, !dia.abierto && styles.diaCerrado]}>{label}</Text>
                </View>
                {dia.abierto ? (
                  <View style={styles.diaHoras}>
                    <TouchableOpacity style={styles.horaPicker} onPress={() => abrirPicker(key, "abre")}>
                      <Text style={styles.horaText}>{dia.abre}</Text>
                    </TouchableOpacity>
                    <Text style={styles.horaSep}>—</Text>
                    <TouchableOpacity style={styles.horaPicker} onPress={() => abrirPicker(key, "cierra")}>
                      <Text style={styles.horaText}>{dia.cierra}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.cerradoText}>Cerrado</Text>
                )}
              </View>
            );
          })}

          {/* Actividades */}
          <Text style={styles.sectionTitle}>Actividades disponibles</Text>
          <Text style={styles.sectionHint}>Tocá para seleccionar las que ofrece tu gimnasio.</Text>
          <View style={styles.chipsWrap}>
            {ACTIVIDADES_PRESET.map((act) => {
              const sel = actividades.includes(act);
              return (
                <TouchableOpacity
                  key={act}
                  style={[styles.chip, sel && styles.chipActive]}
                  onPress={() => toggleActividad(act)}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextActive]}>{act}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {actividadesCustom.length > 0 && (
            <View style={styles.chipsWrap}>
              {actividadesCustom.map((act) => (
                <TouchableOpacity
                  key={act}
                  style={[styles.chip, styles.chipActive, styles.chipCustom]}
                  onPress={() => toggleActividad(act)}
                >
                  <MaterialCommunityIcons name="close" size={12} color={COLORS.bg} style={{ marginRight: 4 }} />
                  <Text style={[styles.chipText, styles.chipTextActive]}>{act}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Agregar actividad personalizada</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={otraActividad}
              onChangeText={setOtraActividad}
              placeholder="Ej: Pole Dance, Taekwondo..."
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
              onSubmitEditing={agregarOtraActividad}
            />
            <TouchableOpacity style={styles.addChipButton} onPress={agregarOtraActividad}>
              <MaterialCommunityIcons name="plus" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Comodidades */}
          <Text style={styles.sectionTitle}>Comodidades</Text>
          <Text style={styles.sectionHint}>Tocá para indicar qué tiene tu gimnasio.</Text>
          <View style={styles.chipsWrap}>
            {COMODIDADES_PRESET.map((com) => {
              const sel = comodidades.includes(com);
              return (
                <TouchableOpacity
                  key={com}
                  style={[styles.chip, sel && styles.chipActive]}
                  onPress={() => toggleComodidad(com)}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextActive]}>{com}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Plan de Gympass */}
          <Text style={styles.sectionTitle}>Plan de Gympass</Text>
          <Text style={styles.sectionHint}>Indicá a qué plan pertenece tu gimnasio. Determina qué usuarios pueden acceder.</Text>
          <View style={styles.planRow}>
            {PLANES_GIMNASIO.map((p) => {
              const sel = planGimnasio === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.planChip,
                    sel && { borderColor: p.color, backgroundColor: p.color + "22" },
                  ]}
                  onPress={() => setPlanGimnasio(p.id)}
                >
                  <MaterialCommunityIcons
                    name="star-circle-outline"
                    size={14}
                    color={sel ? p.color : COLORS.textMuted}
                  />
                  <Text style={[styles.planChipText, sel && { color: p.color, fontWeight: "700" }]}>
                    {p.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Fotos */}
          <Text style={styles.sectionTitle}>Fotos del gimnasio</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={handlePickImage}>
            <Text style={styles.secondaryButtonText}>Seleccionar fotos de la galería</Text>
          </TouchableOpacity>

          {fotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {fotos.map((uri, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri }} style={styles.photo} />
                  <TouchableOpacity style={styles.removeButton} onPress={() => handleRemovePhoto(index)}>
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Guardar detalles</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Picker de hora */}
      {Platform.OS === "ios" ? (
        <Modal visible={picker.visible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={cancelarPickerIOS}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 22, paddingBottom: 40 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24, alignSelf: "flex-start" },
  back: { color: COLORS.green, fontSize: 15 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: COLORS.textMuted, marginTop: 6, marginBottom: 22 },
  card: { backgroundColor: COLORS.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { color: COLORS.green, fontSize: 16, fontWeight: "700", marginTop: 22, marginBottom: 6 },
  sectionHint: { color: COLORS.textMuted, fontSize: 12, marginBottom: 12 },
  label: { color: COLORS.text, fontSize: 14, marginBottom: 8, marginTop: 14 },
  input: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },

  diaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  diaLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  diaLabel: { color: COLORS.text, fontSize: 14, fontWeight: "500", width: 80 },
  diaCerrado: { color: COLORS.textMuted },
  diaHoras: { flexDirection: "row", alignItems: "center", gap: 8 },
  horaPicker: {
    backgroundColor: COLORS.input,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  horaText: { color: COLORS.green, fontSize: 14, fontWeight: "700" },
  horaSep: { color: COLORS.textMuted, fontSize: 14 },
  cerradoText: { color: COLORS.textMuted, fontSize: 13 },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.input,
  },
  chipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  chipCustom: { backgroundColor: COLORS.greenDark, borderColor: COLORS.greenDark },
  chipText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: COLORS.bg, fontWeight: "700" },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  addChipButton: { backgroundColor: COLORS.greenDark, borderRadius: 12, padding: 13 },

  planRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  planChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.input,
  },
  planChipText: { color: COLORS.textMuted, fontSize: 13 },

  button: { backgroundColor: COLORS.greenDark, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  secondaryButton: { borderWidth: 1, borderColor: COLORS.green, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginBottom: 16 },
  secondaryButtonText: { color: COLORS.green, fontSize: 14, fontWeight: "700" },
  photosScroll: { marginTop: 8, marginBottom: 8 },
  photoContainer: { position: "relative", marginRight: 12 },
  photo: { width: 100, height: 100, borderRadius: 12 },
  removeButton: { position: "absolute", top: -6, right: -6, backgroundColor: COLORS.red, width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  removeButtonText: { color: COLORS.text, fontSize: 12, fontWeight: "bold" },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalCard: { backgroundColor: "#1a2535", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalCancel: { color: COLORS.textMuted, fontSize: 16 },
  modalConfirm: { color: COLORS.green, fontSize: 16, fontWeight: "700" },
  iosPicker: { backgroundColor: "#1a2535" },
});
