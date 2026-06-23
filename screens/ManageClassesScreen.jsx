import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { collection, getDocs, doc, deleteDoc, addDoc, serverTimestamp, query, orderBy, where } from "firebase/firestore";
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
  red: "#ef4444",
};

export default function ManageClassesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [clases, setClases] = useState([]);

  const fetchClases = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    try {
      const q = query(collection(db, "gimnasios", user.uid, "clases"), orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      setClases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.log("ManageClasses:", error?.code || error?.message || error);
      setClases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchClases();
    }, [fetchClases])
  );

  function confirmDelete(clase) {
    const displayName = clase.actividad || clase.nombre || "esta clase";
    Alert.alert(
      "Eliminar clase",
      `¿Seguro que querés eliminar la clase de "${displayName}"? Se borrarán también todas las reservas de los alumnos inscriptos.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => handleDelete(clase.id) },
      ]
    );
  }

  async function handleDelete(claseId) {
    const user = auth.currentUser;
    if (!user) return;
    try {
      // Delete all reservations for this class across all dates
      const resSnap = await getDocs(query(
        collection(db, "reservas"),
        where("claseId", "==", claseId),
        where("gymId", "==", user.uid)
      ));

      const clase = clases.find((c) => c.id === claseId);
      const nombreClase = clase?.actividad || clase?.nombre || "la clase";
      const horario = clase?.diaHora || "";

      const promises = [];
      for (const d of resSnap.docs) {
        // Delete the reservation
        promises.push(deleteDoc(doc(db, "reservas", d.id)));
        // Notify the enrolled user
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
      // Delete the class template itself
      promises.push(deleteDoc(doc(db, "gimnasios", user.uid, "clases", claseId)));
      await Promise.all(promises);
      setClases((prev) => prev.filter((c) => c.id !== claseId));
    } catch (error) {
      console.log("Delete class error:", error?.code || error?.message || error);
      Alert.alert("Error", "No se pudo eliminar la clase.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScreenHeader title="Clases" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.subtitle}>Gestioná las clases de tu gimnasio.</Text>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate("AddClass")}
        >
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.text} />
          <Text style={styles.addButtonText}>Agregar clase</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.green} />
          </View>
        ) : clases.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Todavía no agregaste clases.</Text>
          </View>
        ) : (
          clases.map((clase) => (
            <View key={clase.id} style={styles.classCard}>
              {/* Badge de actividad */}
              <View style={styles.activityBadge}>
                <MaterialCommunityIcons name="dumbbell" size={13} color={COLORS.green} />
                <Text style={styles.activityBadgeText} numberOfLines={1}>
                  {clase.actividad || clase.nombre || "Clase"}
                </Text>
              </View>

              {/* Info principal */}
              <Text style={styles.classMeta}>
                {clase.diaHora || "Horario no especificado"}
              </Text>
              {clase.duracion > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <MaterialCommunityIcons name="timer-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.classMetaSmall}>{clase.duracion} min</Text>
                </View>
              )}
              {!!clase.profesor && (
                <Text style={styles.classMetaSmall}>Prof. {clase.profesor}</Text>
              )}
              {!!clase.cupo && (
                <Text style={styles.classMetaSmall}>Cupo: {clase.cupo}</Text>
              )}
              {!!clase.descripcion && (
                <Text style={styles.classDesc} numberOfLines={2}>{clase.descripcion}</Text>
              )}

              {/* Acciones */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigation.navigate("AddClass", { claseId: clase.id })}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={COLORS.green} />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => confirmDelete(clase)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.red} />
                  <Text style={styles.deleteButtonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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

  addButton: {
    backgroundColor: COLORS.greenDark, borderRadius: 14, paddingVertical: 14,
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 6, marginBottom: 18,
  },
  addButtonText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  center: { padding: 30, alignItems: "center" },
  emptyCard: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 18, padding: 24, alignItems: "center", gap: 8,
  },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },

  classCard: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 18, padding: 16, marginBottom: 12,
  },
  activityBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#0a1f0e", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.greenDark,
    marginBottom: 10,
  },
  activityBadgeText: { color: COLORS.green, fontSize: 13, fontWeight: "700" },

  classMeta: { color: COLORS.text, fontSize: 15, fontWeight: "600", marginBottom: 4 },
  classMetaSmall: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  classDesc: { color: COLORS.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },

  actionsRow: {
    flexDirection: "row", gap: 10, marginTop: 14,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12,
  },
  editButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 10, borderWidth: 1, borderColor: COLORS.green,
    paddingVertical: 9,
  },
  editButtonText: { color: COLORS.green, fontSize: 13, fontWeight: "600" },
  deleteButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 10, borderWidth: 1, borderColor: COLORS.red,
    paddingVertical: 9,
  },
  deleteButtonText: { color: COLORS.red, fontSize: 13, fontWeight: "600" },
});
