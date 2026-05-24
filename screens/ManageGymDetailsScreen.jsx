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
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import * as ImagePicker from "expo-image-picker";
import { CLOUDINARY } from "../cloudinaryConfig";

const uploadToCloudinary = async (uri, userId, index) => {
  const formData = new FormData();
  formData.append("file", {
    uri,
    type: "image/jpeg",
    name: `gym_${userId}_${index}_${Date.now()}.jpg`,
  });
  formData.append("upload_preset", CLOUDINARY.uploadPreset);
  formData.append("folder", `gimnasios/${userId}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) throw new Error("Error al subir imagen a Cloudinary");
  const data = await res.json();
  return data.secure_url;
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

// Convierte "08:30" a un objeto Date (solo importa la hora)
function horaStringADate(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// Convierte un Date a "08:30"
function dateAHoraString(date) {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default function ManageGymDetailsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [descripcion, setDescripcion] = useState("");
  const [horarios, setHorarios] = useState(HORARIOS_DEFAULT);
  const [comodidades, setComodidades] = useState("");
  const [fotos, setFotos] = useState([]);

  // Control del picker de hora
  const [picker, setPicker] = useState({
    visible: false,
    dia: null,
    campo: null,
  });
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
          setComodidades(data.comodidades || "");
          setFotos(data.fotos || []);

          // Si ya tenía horarios como objeto los usamos, sino los defaults
          if (data.horarios && typeof data.horarios === "object" && Object.keys(data.horarios).length > 0) {
            setHorarios({ ...HORARIOS_DEFAULT, ...data.horarios });
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

  function abrirPicker(dia, campo) {
    const horaActual = horarios[dia]?.[campo] || "08:00";
    setTempHora(horaStringADate(horaActual));
    setPicker({ visible: true, dia, campo });
  }

  function onPickerChange(event, selectedDate) {
    if (!selectedDate) return;
    if (Platform.OS === "android") {
      // En Android confirmamos directo
      setPicker((p) => ({ ...p, visible: false }));
      if (event.type === "dismissed") return;
      const horaStr = dateAHoraString(selectedDate);
      setHorarios((prev) => ({
        ...prev,
        [picker.dia]: { ...prev[picker.dia], [picker.campo]: horaStr },
      }));
    } else {
      // En iOS solo actualizamos el valor temporal mientras scrollea
      setTempHora(selectedDate);
    }
  }

  function confirmarHoraIOS() {
    const horaStr = dateAHoraString(tempHora);
    setHorarios((prev) => ({
      ...prev,
      [picker.dia]: { ...prev[picker.dia], [picker.campo]: horaStr },
    }));
    setPicker((p) => ({ ...p, visible: false }));
  }

  function cancelarPickerIOS() {
    setPicker((p) => ({ ...p, visible: false }));
  }

  function toggleDia(dia) {
    setHorarios((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], abierto: !prev[dia].abierto },
    }));
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
    if (!result.canceled) {
      setFotos((prev) => [...prev, result.assets[0].uri]);
    }
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
        comodidades: comodidades.trim(),
        fotos: fotosSubidas,
      }, { merge: true });

      Alert.alert(
        "Éxito",
        "Los detalles del gimnasio se actualizaron correctamente.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.back}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Detalles del Gimnasio</Text>
        <Text style={styles.subtitle}>Agregá fotos y descripción a tu perfil público.</Text>

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
                  <Text style={[styles.diaLabel, !dia.abierto && styles.diaCerrado]}>
                    {label}
                  </Text>
                </View>

                {dia.abierto ? (
                  <View style={styles.diaHoras}>
                    <TouchableOpacity
                      style={styles.horaPicker}
                      onPress={() => abrirPicker(key, "abre")}
                    >
                      <Text style={styles.horaText}>{dia.abre}</Text>
                    </TouchableOpacity>
                    <Text style={styles.horaSep}>—</Text>
                    <TouchableOpacity
                      style={styles.horaPicker}
                      onPress={() => abrirPicker(key, "cierra")}
                    >
                      <Text style={styles.horaText}>{dia.cierra}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.cerradoText}>Cerrado</Text>
                )}
              </View>
            );
          })}

          {/* Comodidades */}
          <Text style={styles.sectionTitle}>Comodidades</Text>
          <TextInput
            style={styles.input}
            value={comodidades}
            onChangeText={setComodidades}
            placeholder="Ej: WiFi, Duchas, Lockers"
            placeholderTextColor={COLORS.textMuted}
          />

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
            {saving
              ? <ActivityIndicator color={COLORS.text} />
              : <Text style={styles.buttonText}>Guardar detalles</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Picker de hora — Modal en iOS, inline en Android */}
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
    marginBottom: 12,
  },
  label: { color: COLORS.text, fontSize: 14, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: { minHeight: 100 },

  // Fila de cada día
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

  button: {
    backgroundColor: COLORS.greenDark,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },

  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  secondaryButtonText: { color: COLORS.green, fontSize: 14, fontWeight: "700" },

  photosScroll: { marginTop: 8, marginBottom: 8 },
  photoContainer: { position: "relative", marginRight: 12 },
  photo: { width: 100, height: 100, borderRadius: 12 },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: COLORS.red,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonText: { color: COLORS.text, fontSize: 12, fontWeight: "bold" },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCard: {
    backgroundColor: "#1a2535",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCancel: { color: COLORS.textMuted, fontSize: 16 },
  modalConfirm: { color: COLORS.green, fontSize: 16, fontWeight: "700" },
  iosPicker: { backgroundColor: "#1a2535" },
});