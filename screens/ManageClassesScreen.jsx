import React, { useState, useEffect, useCallback } from "react";
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
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

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
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const clasesRef = collection(db, "gimnasios", user.uid, "clases");
      const q = query(clasesRef, orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClases(items);
    } catch (error) {
      // Si todavía no existe la subcolección, getDocs devuelve vacío sin error.
      // Si hay un error de permisos, lo logueamos en silencio.
      console.log(
        "ManageClasses: no se pudo leer clases",
        error?.code || error?.message || error
      );
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
    Alert.alert(
      "Cancelar clase",
      `¿Seguro que querés cancelar "${clase.nombre}"?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: () => handleDelete(clase.id),
        },
      ]
    );
  }

  async function handleDelete(claseId) {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, "gimnasios", user.uid, "clases", claseId));
      setClases((prev) => prev.filter((c) => c.id !== claseId));
    } catch (error) {
      console.log("Delete class error:", error?.code || error?.message || error);
      Alert.alert("Error", "No se pudo cancelar la clase.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.back}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Clases</Text>
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
            <MaterialCommunityIcons
              name="calendar-blank-outline"
              size={32}
              color={COLORS.textMuted}
            />
            <Text style={styles.emptyText}>Todavía no agregaste clases.</Text>
          </View>
        ) : (
          clases.map((clase) => (
            <View key={clase.id} style={styles.classCard}>
              <View style={styles.classInfo}>
                <Text style={styles.className}>{clase.nombre}</Text>
                <Text style={styles.classMeta}>
                  {clase.diaHora}
                  {clase.duracion ? ` · ${clase.duracion} min` : ""}
                </Text>
                {!!clase.profesor && (
                  <Text style={styles.classMetaSmall}>Prof. {clase.profesor}</Text>
                )}
                {!!clase.cupo && (
                  <Text style={styles.classMetaSmall}>Cupo: {clase.cupo}</Text>
                )}
                {!!clase.descripcion && (
                  <Text style={styles.classDesc}>{clase.descripcion}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => confirmDelete(clase)}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={COLORS.red} />
              </TouchableOpacity>
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
    alignSelf: "flex-start",
  },
  back: { color: COLORS.green, fontSize: 15 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: COLORS.textMuted, marginTop: 6, marginBottom: 22 },

  addButton: {
    backgroundColor: COLORS.greenDark,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 18,
  },
  addButtonText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },

  center: { padding: 30, alignItems: "center" },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },

  classCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  classInfo: { flex: 1 },
  className: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  classMeta: { color: COLORS.green, fontSize: 13, marginTop: 4 },
  classMetaSmall: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  classDesc: { color: COLORS.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },

  cancelButton: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.red,
  },
});
