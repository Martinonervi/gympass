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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import * as ImagePicker from "expo-image-picker";

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

export default function ManageGymDetailsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [descripcion, setDescripcion] = useState("");
  const [horarios, setHorarios] = useState("");
  const [comodidades, setComodidades] = useState("");
  const [fotos, setFotos] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const gymDocRef = doc(db, "gimnasios", user.uid);
        const gymDocSnap = await getDoc(gymDocRef);

        if (gymDocSnap.exists()) {
          const gymData = gymDocSnap.data();
          setDescripcion(gymData.descripcion || "");
          setHorarios(gymData.horarios || "");
          setComodidades(gymData.comodidades || "");
          setFotos(gymData.fotos || []);
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

  const handlePickImage = async () => {
    // Pedir permisos primero
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permiso denegado", "Se requiere permiso para acceder a la galería.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      // Mock de subida: simplemente agregamos la URI local al array de fotos
      setFotos((prevFotos) => [...prevFotos, result.assets[0].uri]);
    }
  };

  const handleRemovePhoto = (index) => {
    setFotos((prevFotos) => prevFotos.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // 1. Validaciones de campos obligatorios (Criterio de Aceptación de la US 25 y 26)
    // Asumimos que nombre, direccion y contacto ya los validaron en ProfileScreen o RegisterScreen.
    // Acá validamos los que pide esta pantalla: horarios.
    if (!horarios.trim()) {
      Alert.alert("Campos incompletos", "Los horarios de atención son obligatorios.");
      return;
    }

    try {
      setSaving(true);
      const user = auth.currentUser;

      if (!user) throw new Error("No hay usuario autenticado.");

      const gymDocRef = doc(db, "gimnasios", user.uid);

      // TODO: Implementar subida real a Firebase Storage de cada URI local en el array 'fotos'.
      await updateDoc(gymDocRef, {
        descripcion: descripcion.trim(), // Es opcional según la US
        horarios: horarios.trim(),       // Obligatorio
        comodidades: comodidades.trim(), // Es opcional según la US
        fotos: fotos,
      });

      // Mensaje de confirmación (Criterio de Aceptación de la US 26)
      Alert.alert(
        "Éxito",
        "Los detalles del gimnasio se actualizaron correctamente.",
        [
          { text: "OK", onPress: () => navigation.goBack() }
        ]
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={COLORS.green}
          />
          <Text style={styles.back}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Detalles del Gimnasio</Text>
        <Text style={styles.subtitle}>Agregá fotos y descripción a tu perfil público.</Text>

        <View style={styles.card}>
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

          <Text style={styles.label}>Horarios de atención</Text>
          <TextInput
            style={styles.input}
            value={horarios}
            onChangeText={setHorarios}
            placeholder="Ej: Lunes a Viernes 8:00 a 22:00 hs"
            placeholderTextColor={COLORS.textMuted}
          />

          <Text style={styles.label}>Comodidades</Text>
          <TextInput
            style={styles.input}
            value={comodidades}
            onChangeText={setComodidades}
            placeholder="Ej: WiFi, Duchas, Lockers"
            placeholderTextColor={COLORS.textMuted}
          />

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
            {saving ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.buttonText}>Guardar detalles</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    padding: 22,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
    alignSelf: "flex-start",
  },
  back: {
    color: COLORS.green,
    fontSize: 15,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 22,
  },
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
  label: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    minHeight: 100,
  },
  button: {
    backgroundColor: COLORS.greenDark,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: COLORS.green,
    fontSize: 14,
    fontWeight: "700",
  },
  photosScroll: {
    marginTop: 8,
    marginBottom: 8,
  },
  photoContainer: {
    position: 'relative',
    marginRight: 12,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.red,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
