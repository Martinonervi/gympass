import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  greenDark: "#16a34a",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  error: "#ef4444",
};

export default function GymDetailScreen({ route, navigation }) {
  const { gymId } = route.params;

  const [loading, setLoading] = useState(true);
  const [gymData, setGymData] = useState(null);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    async function fetchGymDetails() {
      try {
        const gymDocRef = doc(db, "gimnasios", gymId);
        const clasesCollRef = collection(db, "gimnasios", gymId, "clases");

        const [gymDocSnapshot, clasesSnapshot] = await Promise.all([
          getDoc(gymDocRef),
          getDocs(clasesCollRef),
        ]);

        if (gymDocSnapshot.exists()) {
          setGymData(gymDocSnapshot.data());
        }

        const loadedClasses = [];
        clasesSnapshot.forEach((doc) => {
          loadedClasses.push({ id: doc.id, ...doc.data() });
        });
        setClasses(loadedClasses);
      } catch (error) {
        console.error("Error fetching gym details:", error);
      } finally {
        setLoading(false);
      }
    }

    if (gymId) {
      fetchGymDetails();
    }
  }, [gymId]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ActivityIndicator size="large" color={COLORS.green} />
      </SafeAreaView>
    );
  }

  if (!gymData) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <TouchableOpacity style={styles.backButtonTop} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.back}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>No se encontró la información del gimnasio.</Text>
      </SafeAreaView>
    );
  }

  const {
    nombre = "Gimnasio",
    descripcion,
    horarios,
    comodidades,
    fotos = [],
  } = gymData;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.back}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{nombre}</Text>

        {fotos && fotos.length > 0 && (
          <View style={styles.photosSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosCarousel}>
              {fotos.map((fotoUrl, index) => (
                <Image key={index} source={{ uri: fotoUrl }} style={styles.photo} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.sectionContent}>{descripcion || "No especificado"}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Horarios</Text>
          {horarios && typeof horarios === "object" ? (
            ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"].map((dia) => {
              const info = horarios[dia];
              if (!info) return null;
              return (
                <View key={dia} style={styles.horarioRow}>
                  <Text style={styles.horarioDia}>
                    {dia.charAt(0).toUpperCase() + dia.slice(1)}
                  </Text>
                  {info.abierto ? (
                    <Text style={styles.horarioHora}>{info.abre} — {info.cierra}</Text>
                  ) : (
                    <Text style={styles.horarioCerrado}>Cerrado</Text>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.sectionContent}>No especificado</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comodidades</Text>
          <Text style={styles.sectionContent}>{comodidades || "No especificado"}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clases disponibles</Text>
          {classes.length === 0 ? (
            <Text style={styles.sectionContent}>No hay clases disponibles por el momento.</Text>
          ) : (
            <View style={styles.classesList}>
              {classes.map((cls) => (
                <View key={cls.id} style={styles.classCard}>
                  <Text style={styles.className}>{cls.nombre}</Text>
                  <View style={styles.classDetails}>
                    <MaterialCommunityIcons name="calendar-clock" size={16} color={COLORS.textMuted} />
                    <Text style={styles.classDetailText}>{cls.diaHora || "Horario no especificado"}</Text>
                  </View>
                  <View style={styles.classDetails}>
                    <MaterialCommunityIcons name="timer-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.classDetailText}>
                      {cls.duracion ? `${cls.duracion} min` : "Duración no especificada"}
                    </Text>
                  </View>
                  <View style={styles.classDetails}>
                    <MaterialCommunityIcons name="account-tie" size={16} color={COLORS.textMuted} />
                    <Text style={styles.classDetailText}>{cls.profesor || "Profesor no especificado"}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { justifyContent: "center", alignItems: "center", padding: 22 },
  container: { padding: 22, paddingBottom: 40 },
  backButtonTop: {
    position: "absolute",
    top: 22,
    left: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24, alignSelf: "flex-start" },
  back: { color: COLORS.green, fontSize: 15 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "800", marginBottom: 20 },
  errorText: { color: COLORS.error, fontSize: 16, textAlign: "center", marginTop: 40 },
  
  photosSection: { marginBottom: 24 },
  photosCarousel: { gap: 12, paddingRight: 22 },
  photo: { width: 300, height: 200, borderRadius: 16, backgroundColor: COLORS.card },
  
  section: { marginBottom: 24 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  sectionContent: { color: COLORS.textMuted, fontSize: 15, lineHeight: 22 },
  horarioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  horarioDia: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    width: 100,
  },
  horarioHora: {
    color: COLORS.green,
    fontSize: 14,
  },
  horarioCerrado: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  classesList: { gap: 12, marginTop: 8 },
  classCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  className: { color: COLORS.green, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  classDetails: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  classDetailText: { color: COLORS.text, fontSize: 14 },
});
