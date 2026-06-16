import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  doc,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  increment,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as XLSX from "xlsx";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  error: "#ef4444",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  placeholder: "#475569",
};

export default function EmployerManageEmployeesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [employerData, setEmployerData] = useState({
    cuposTotales: 0,
    cuposUsados: 0,
    planTipo: "Sin Plan",
    planPagado: false,
  });
  const [nomina, setNomina] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Escuchar datos del empleador
    const employerRef = doc(db, "empleadores", user.uid);
    const unsubEmployer = onSnapshot(employerRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // El plan se considera vigente solo si está pagado y no venció.
        const vencido =
          data.planVence && data.planVence.toDate
            ? data.planVence.toDate() <= new Date()
            : false;
        setEmployerData({
          cuposTotales: data.cuposTotales || 0,
          cuposUsados: data.cuposUsados || 0,
          planTipo: data.planTipo || "Sin Plan",
          planPagado: data.planPagado === true && !vencido,
        });
      }
    });

    // Escuchar nómina
    const nominaRef = collection(db, "empleadores", user.uid, "nomina");
    const unsubNomina = onSnapshot(nominaRef, (querySnapshot) => {
      const empleados = [];
      querySnapshot.forEach((docSnap) => {
        empleados.push({ id: docSnap.id, ...docSnap.data() });
      });
      setNomina(empleados);
      setLoading(false);
    });

    return () => {
      unsubEmployer();
      unsubNomina();
    };
  }, []);

  const handleAddEmployee = async () => {
    if (!employerData.planPagado) {
      Alert.alert(
        "Plan no pagado",
        "Necesitás un plan corporativo pagado y vigente para cargar empleados. Configurá y pagá tu plan primero."
      );
      return;
    }
    if (!newEmail.trim()) {
      Alert.alert("Error", "Ingresá un correo electrónico válido.");
      return;
    }

    if (employerData.cuposUsados >= employerData.cuposTotales) {
      Alert.alert(
        "Límite alcanzado",
        "Límite de cupos alcanzado. Amplíe su plan para agregar más empleados."
      );
      return;
    }

    try {
      setIsAdding(true);
      const user = auth.currentUser;
      const employerRef = doc(db, "empleadores", user.uid);
      const nominaRef = collection(db, "empleadores", user.uid, "nomina");

      await addDoc(nominaRef, {
        email: newEmail.trim().toLowerCase(),
        estado: "activo",
      });

      await updateDoc(employerRef, {
        cuposUsados: increment(1),
      });

      setNewEmail("");
    } catch (error) {
      console.error("Error agregando empleado:", error);
      Alert.alert("Error", "No se pudo agregar el empleado. Intentá de nuevo.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleImportCSV = async () => {
    if (!employerData.planPagado) {
      Alert.alert(
        "Plan no pagado",
        "Necesitás un plan corporativo pagado y vigente para cargar empleados. Configurá y pagá tu plan primero."
      );
      return;
    }
    try {
      // 1. Elegir archivo (CSV o Excel)
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "text/plain",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;

      const asset = res.assets[0];
      const nombre = (asset.name || "").toLowerCase();
      const esXlsx = nombre.endsWith(".xlsx") || nombre.endsWith(".xls");
      const esCsv = nombre.endsWith(".csv") || nombre.endsWith(".txt");

      // 2. Validar el formato ANTES de leer: solo CSV o Excel.
      if (!esXlsx && !esCsv) {
        Alert.alert(
          "Formato no admitido",
          "El archivo debe ser CSV o Excel (.xlsx). Subí un archivo válido con los correos de los empleados."
        );
        return;
      }

      setIsImporting(true);

      // 3. Leer el contenido según el tipo de archivo.
      let contenido = "";
      const file = new File(asset.uri);

      if (esXlsx) {
        // Excel: parseamos el binario y convertimos cada hoja a texto plano.
        const bytes = await file.bytes();
        const wb = XLSX.read(bytes, { type: "array" });
        wb.SheetNames.forEach((hoja) => {
          contenido += XLSX.utils.sheet_to_csv(wb.Sheets[hoja]) + "\n";
        });
      } else {
        // CSV / TXT: lectura directa como texto.
        contenido = await file.text();
      }

      // 4. Extraer todos los emails válidos (sin importar comas, ; o saltos de línea)
      const encontrados = contenido.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];

      // Normalizar a minúsculas y quitar duplicados dentro del archivo
      const emailsArchivo = [...new Set(encontrados.map((e) => e.toLowerCase()))];

      if (emailsArchivo.length === 0) {
        Alert.alert("Sin emails", "No se encontraron correos válidos en el archivo.");
        return;
      }

      // 4. Descartar los que ya están en la nómina
      const yaCargados = new Set(nomina.map((n) => (n.email || "").toLowerCase()));
      const nuevos = emailsArchivo.filter((e) => !yaCargados.has(e));
      const duplicados = emailsArchivo.length - nuevos.length;

      // 5. Respetar el tope de cupos: cargar solo hasta llenar los disponibles
      const disponibles = Math.max(0, employerData.cuposTotales - employerData.cuposUsados);

      if (disponibles === 0) {
        Alert.alert(
          "Sin cupos disponibles",
          "Ya alcanzaste el total de cupos de tu plan. Ampliá el plan para cargar más empleados."
        );
        return;
      }

      const aCargar = nuevos.slice(0, disponibles);
      const fueraPorCupo = nuevos.length - aCargar.length;

      if (aCargar.length === 0) {
        Alert.alert(
          "Nada para cargar",
          duplicados > 0
            ? "Todos los correos del archivo ya estaban en la nómina."
            : "No hay cupos disponibles para los correos del archivo."
        );
        return;
      }

      // 6. Alta masiva en un único batch + actualización de cupos usados
      const user = auth.currentUser;
      const nominaRef = collection(db, "empleadores", user.uid, "nomina");
      const employerRef = doc(db, "empleadores", user.uid);

      const batch = writeBatch(db);
      aCargar.forEach((email) => {
        const nuevoDoc = doc(nominaRef);
        batch.set(nuevoDoc, { email, estado: "activo" });
      });
      batch.update(employerRef, { cuposUsados: increment(aCargar.length) });
      await batch.commit();

      // 7. Resumen
      let mensaje = `Se cargaron ${aCargar.length} empleado${aCargar.length !== 1 ? "s" : ""}.`;
      if (duplicados > 0) mensaje += `\n${duplicados} ya estaban en la nómina.`;
      if (fueraPorCupo > 0) mensaje += `\n${fueraPorCupo} quedaron afuera por falta de cupos.`;
      Alert.alert("Importación completa", mensaje);
    } catch (error) {
      console.error("Error importando archivo:", error);
      Alert.alert(
        "No se pudo leer el archivo",
        "El archivo está dañado o no tiene un formato válido. Asegurate de subir un CSV o Excel (.xlsx) con los correos."
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemoveEmployee = (employeeId, email) => {
    Alert.alert(
      "Confirmar baja",
      `¿Estás seguro de que querés dar de baja a ${email}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Dar de baja",
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth.currentUser;
              const empDocRef = doc(
                db,
                "empleadores",
                user.uid,
                "nomina",
                employeeId
              );
              const employerRef = doc(db, "empleadores", user.uid);

              await deleteDoc(empDocRef);
              await updateDoc(employerRef, {
                cuposUsados: increment(-1),
              });
            } catch (error) {
              console.error("Error eliminando empleado:", error);
              Alert.alert(
                "Error",
                "No se pudo dar de baja al empleado."
              );
            }
          },
        },
      ]
    );
  };

  const renderEmployee = ({ item }) => (
    <View style={styles.employeeCard}>
      <View style={styles.employeeInfo}>
        <MaterialCommunityIcons name="account-outline" size={24} color={COLORS.text} />
        <View style={styles.employeeTextContainer}>
          <Text style={styles.employeeEmail}>{item.email}</Text>
          <Text style={styles.employeeStatus}>
            {item.estado === "activo" ? "Activo" : item.estado}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => handleRemoveEmployee(item.id, item.email)}
        style={styles.removeButton}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={24} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  const progress =
    employerData.cuposTotales > 0
      ? (employerData.cuposUsados / employerData.cuposTotales) * 100
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nómina de Empleados</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {/* Dashboard Header */}
          <View style={styles.dashboardCard}>
            <View style={styles.planHeader}>
              <Text style={styles.planTitle}>Plan Actual</Text>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>{employerData.planTipo}</Text>
              </View>
            </View>
            
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Cupos Utilizados</Text>
                <Text style={styles.progressText}>
                  {employerData.cuposUsados} de {employerData.cuposTotales}
                </Text>
              </View>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(progress, 100)}%` },
                    progress >= 100 && { backgroundColor: COLORS.error }
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Add Employee Section */}
          <View style={styles.addSection}>
            <Text style={styles.sectionTitle}>Agregar Empleado</Text>

            {!employerData.planPagado && (
              <View style={styles.lockedBanner}>
                <MaterialCommunityIcons name="lock-outline" size={18} color={COLORS.error} />
                <Text style={styles.lockedBannerText}>
                  Necesitás un plan pagado y vigente para cargar empleados.
                </Text>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Email del empleado"
                placeholderTextColor={COLORS.placeholder}
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={employerData.planPagado}
              />
              <TouchableOpacity
                style={[styles.addButton, (isAdding || !employerData.planPagado) && styles.buttonDisabled]}
                onPress={handleAddEmployee}
                disabled={isAdding || !employerData.planPagado}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color={COLORS.bg} />
                ) : (
                  <Text style={styles.addButtonText}>Agregar</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Importación masiva por CSV */}
            <TouchableOpacity
              style={[styles.csvButton, (isImporting || !employerData.planPagado) && styles.buttonDisabled]}
              onPress={handleImportCSV}
              disabled={isImporting || !employerData.planPagado}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color={COLORS.green} />
              ) : (
                <>
                  <MaterialCommunityIcons name="file-upload-outline" size={20} color={COLORS.green} />
                  <Text style={styles.csvButtonText}>Importar empleados (CSV o Excel)</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.csvHint}>
              Archivo CSV o Excel (.xlsx) con los correos de los empleados. Se cargan hasta completar los cupos del plan.
            </Text>
          </View>

          {/* Employee List Section */}
          <Text style={styles.sectionTitle}>Empleados Activos ({nomina.length})</Text>
          <FlatList
            data={nomina}
            keyExtractor={(item) => item.id}
            renderItem={renderEmployee}
            contentContainerStyle={styles.listContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="account-group-outline" size={48} color={COLORS.placeholder} />
                <Text style={styles.emptyText}>No hay empleados en la nómina.</Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex1: {
    flex: 1,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  dashboardCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  planTitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  planBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  planBadgeText: {
    color: COLORS.green,
    fontWeight: "bold",
    fontSize: 14,
  },
  progressSection: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
  },
  progressText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "bold",
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.green,
    borderRadius: 4,
  },
  addSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: COLORS.text,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    color: COLORS.bg,
    fontWeight: "bold",
    fontSize: 14,
  },
  csvButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  csvButtonText: {
    color: COLORS.green,
    fontWeight: "bold",
    fontSize: 14,
  },
  csvHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
  },
  lockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  lockedBannerText: {
    color: COLORS.error,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  listContainer: {
    paddingBottom: 20,
  },
  employeeCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  employeeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  employeeTextContainer: {
    flex: 1,
  },
  employeeEmail: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  employeeStatus: {
    color: COLORS.green,
    fontSize: 12,
    textTransform: "capitalize",
  },
  removeButton: {
    padding: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.placeholder,
    marginTop: 12,
    fontSize: 14,
  },
});
