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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, doc, getDoc, getDocs, addDoc, query, where, limit, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

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
  const [userRole, setUserRole] = useState(null);
  const [userPlan, setUserPlan] = useState(null);
  const [reservando, setReservando] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const user = auth.currentUser;
        const gymDocRef = doc(db, "gimnasios", gymId);

        const promises = [getDoc(gymDocRef)];
        if (user) {
          promises.push(getDoc(doc(db, "usuarios", user.uid)));
        }

        const [gymSnap, userSnap] = await Promise.all(promises);

        if (gymSnap.exists()) setGymData(gymSnap.data());

        if (userSnap?.exists()) {
          setUserRole(userSnap.data().rol);
          setUserPlan(userSnap.data().plan || null);
        }
      } catch (error) {
        console.error("Error fetching gym details:", error);
      } finally {
        setLoading(false);
      }
    }

    if (gymId) fetchData();
  }, [gymId]);

  const yaReservo = async (tipo) => {
    const user = auth.currentUser;
    if (!user) return false;
    const snap = await getDocs(query(
      collection(db, "reservas"),
      where("userId", "==", user.uid),
      where("gymId", "==", gymId),
      where("tipo", "==", tipo),
      limit(1)
    ));
    return !snap.empty;
  };

  const reservarPase = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!userPlan) {
      Alert.alert(
        "Sin plan activo",
        "No tenés un plan activo. Adquirí un plan para poder reservar pases en los gimnasios.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Ver planes", onPress: () => navigation.navigate("Tabs", { screen: "PassTab" }) },
        ]
      );
      return;
    }

    setReservando(true);
    try {
      if (await yaReservo("pase")) {
        Alert.alert("Ya reservaste", `Ya tenés un pase reservado para ${gymData?.nombreGimnasio || "este gimnasio"}.`);
        return;
      }
      await addDoc(collection(db, "reservas"), {
        userId: user.uid,
        tipo: "pase",
        gymId,
        nombreGimnasio: gymData?.nombreGimnasio || gymData?.nombre || "",
        fecha: serverTimestamp(),
        estado: "pendiente",
      });
      Alert.alert("¡Reserva realizada!", `Tu pase para ${gymData?.nombreGimnasio || "el gimnasio"} fue realizado con éxito.`);
    } catch (e) {
      console.error("Error reservando pase:", e);
      Alert.alert("Error", e.message || "No se pudo realizar la reserva. Intentá de nuevo.");
    } finally {
      setReservando(false);
    }
  };

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

  const { nombre = "Gimnasio", descripcion, horarios, fotos = [] } = gymData;
  const esCliente = userRole === "usuario";

  const hasCoords =
    !isNaN(Number(gymData.latitude)) &&
    !isNaN(Number(gymData.longitude)) &&
    gymData.latitude !== undefined &&
    gymData.longitude !== undefined;

  const handleVerEnMapa = () => {
    navigation.navigate("Map", {
      latitude: gymData.latitude,
      longitude: gymData.longitude,
      gymName: gymData.nombreGimnasio || nombre,
    });
  };

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

        <View style={styles.actionsRow}>
          {esCliente && (
            <TouchableOpacity
              style={[styles.reserveButton, reservando && styles.reserveButtonDisabled, { flex: 1 }]}
              onPress={reservarPase}
              disabled={reservando}
            >
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color="#fff" />
              <Text style={styles.reserveButtonText}>
                {reservando ? "Reservando..." : "Reservar pase"}
              </Text>
            </TouchableOpacity>
          )}
          {hasCoords && (
            <TouchableOpacity style={styles.mapButton} onPress={handleVerEnMapa}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.green} />
              <Text style={styles.mapButtonText}>Ver en mapa</Text>
            </TouchableOpacity>
          )}
        </View>

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

        {gymData.actividades?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actividades</Text>
            <View style={styles.chipsWrap}>
              {gymData.actividades.map((act) => (
                <View key={act} style={styles.activityChip}>
                  <Text style={styles.activityChipText}>{act}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {(Array.isArray(gymData.comodidades) ? gymData.comodidades.length > 0 : gymData.comodidades) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comodidades</Text>
            {Array.isArray(gymData.comodidades) ? (
              <View style={styles.chipsWrap}>
                {gymData.comodidades.map((com) => (
                  <View key={com} style={styles.amenityChip}>
                    <Text style={styles.amenityChipText}>{com}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionContent}>{gymData.comodidades}</Text>
            )}
          </View>
        )}

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

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
    alignItems: "stretch",
  },
  reserveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.green,
    borderRadius: 14,
    paddingVertical: 14,
  },
  reserveButtonDisabled: { opacity: 0.6 },
  reserveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  mapButtonText: { color: COLORS.green, fontSize: 14, fontWeight: "600" },

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
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  activityChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#0a1f0e",
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  activityChipText: { color: COLORS.green, fontSize: 13, fontWeight: "600" },
  amenityChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  amenityChipText: { color: COLORS.textMuted, fontSize: 13 },
});
