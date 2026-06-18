import React, { useState, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, StyleSheet, StatusBar, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  collection, getDocs, addDoc, deleteDoc, updateDoc,
  doc, query, where, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const COLORS = {
  bg:        "#0f1520",
  card:      "#152030",
  green:     "#22c55e",
  greenDark: "#16a34a",
  border:    "#243244",
  text:      "#ffffff",
  textMuted: "#94a3b8",
  input:     "#111827",
  red:       "#ef4444",
};

// Sunday=0 … Saturday=6 (matches JS Date.getDay())
const DAY_JS_INDEX = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3,
  jueves: 4, viernes: 5, sabado: 6,
};

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Generate one instance per class per day for the next 14 days, skipping ones already over. */
function generateInstances(clases) {
  const now   = new Date();
  const result = [];

  for (let offset = 0; offset < 14; offset++) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    date.setHours(0, 0, 0, 0);

    const dayNum  = date.getDay();
    const dayName = Object.keys(DAY_JS_INDEX).find((k) => DAY_JS_INDEX[k] === dayNum);
    const fechaStr = toDateStr(date);

    for (const clase of clases) {
      if (clase.dia !== dayName) continue;

      // Skip if class end-time already passed today
      const [h, m] = (clase.horaFin || "23:59").split(":").map(Number);
      const endTime = new Date(date);
      endTime.setHours(h, m, 0, 0);
      if (endTime <= now) continue;

      result.push({
        ...clase,
        fechaStr,
        displayDate: date.toLocaleDateString("es-AR", {
          weekday: "long", day: "numeric", month: "long",
        }),
      });
    }
  }

  // Sort by date then start time
  return result.sort((a, b) => {
    if (a.fechaStr !== b.fechaStr) return a.fechaStr < b.fechaStr ? -1 : 1;
    return (a.horaInicio || "") < (b.horaInicio || "") ? -1 : 1;
  });
}

/** Group a flat list of instances into [{fechaStr, displayDate, items}] */
function groupByDate(instances) {
  const groups = [];
  let cur = null;
  for (const inst of instances) {
    if (!cur || cur.fechaStr !== inst.fechaStr) {
      cur = { fechaStr: inst.fechaStr, displayDate: inst.displayDate, items: [] };
      groups.push(cur);
    }
    cur.items.push(inst);
  }
  return groups;
}

// ─── Snackbar ─────────────────────────────────────────────────────────────────
function Snackbar({ message, type = "error", visible }) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: visible ? 0 : 100, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity,    { toValue: visible ? 1 : 0,   duration: 220,         useNativeDriver: true }),
    ]).start();
  }, [visible]);
  const ok = type === "success";
  return (
    <Animated.View
      style={[styles.snackbar, ok ? styles.snackbarOk : styles.snackbarErr,
        { transform: [{ translateY }], opacity }]}
      pointerEvents="none"
    >
      <Text style={styles.snackbarIcon}>{ok ? "✓" : "✕"}</Text>
      <Text style={styles.snackbarText}>{message}</Text>
    </Animated.View>
  );
}

function useSnackbar() {
  const [sb, setSb] = useState({ visible: false, message: "", type: "error" });
  const timer = useRef(null);
  function show(message, type = "error", ms = 3500) {
    if (timer.current) clearTimeout(timer.current);
    setSb({ visible: true, message, type });
    timer.current = setTimeout(() => setSb((p) => ({ ...p, visible: false })), ms);
  }
  return { snackbar: sb, showSnackbar: show };
}

// ─── ClassCalendarScreen ──────────────────────────────────────────────────────
export default function ClassCalendarScreen({ route, navigation }) {
  const { gymId, gymName, userPlan, nombreUsuario = "" } = route.params;

  const [loading,    setLoading]    = useState(true);
  const [templates,  setTemplates]  = useState([]);
  const [reservas,   setReservas]   = useState([]);
  const [busy,       setBusy]       = useState(false);
  const { snackbar, showSnackbar }  = useSnackbar();

  const canEnroll = userPlan === "platinum" || userPlan === "black";
  const user      = auth.currentUser;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function fetchData() {
        try {
          const clasesSnap = await getDocs(
            collection(db, "gimnasios", gymId, "clases")
          );
          const resSnap = await getDocs(query(
            collection(db, "reservas"),
            where("gymId", "==", gymId),
            where("tipo", "==", "clase")
          ));
          if (!active) return;
          setTemplates(clasesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setReservas(resSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (e) {
          console.error("ClassCalendar fetchData:", e);
        } finally {
          if (active) setLoading(false);
        }
      }
      fetchData();
      return () => { active = false; };
    }, [gymId])
  );

  async function handleEnroll(instance) {
    if (!user) return;

    if (!canEnroll) {
      Alert.alert(
        "Plan insuficiente",
        "Para inscribirte a clases necesitás el plan Platinum o Black. Podés actualizarlo desde la sección de planes.",
        [
          { text: "Cerrar", style: "cancel" },
          { text: "Ver planes", onPress: () => navigation.navigate("Tabs", { screen: "PassTab" }) },
        ]
      );
      return;
    }

    const { id: claseId, fechaStr, actividad, horaInicio, horaFin, displayDate, cupo } = instance;

    const alreadyIn = reservas.some(
      (r) => r.claseId === claseId && r.claseFecha === fechaStr && r.userId === user.uid
    );
    if (alreadyIn) { showSnackbar("Ya estás inscripto en esta clase."); return; }

    const enrolled = reservas.filter(
      (r) => r.claseId === claseId && r.claseFecha === fechaStr
    ).length;
    if (cupo && enrolled >= cupo) { showSnackbar("La clase está completa."); return; }

    setBusy(true);
    try {
      const payload = {
        userId:            user.uid,
        nombreUsuario,
        emailUsuario:      user.email || "",
        tipo:              "clase",
        gymId,
        nombreGimnasio:    gymName,
        claseId,
        actividad,
        horaInicio,
        horaFin,
        claseFecha:        fechaStr,
        claseFechaDisplay: displayDate,
        diaHora:           `${displayDate} · ${horaInicio} - ${horaFin}`,
        fecha:             serverTimestamp(),
        estado:            "pendiente",
        planUsuario: userPlan ? userPlan.toLowerCase() : "classic",
      };
      const ref = await addDoc(collection(db, "reservas"), payload);
      setReservas((prev) => [
        ...prev,
        { id: ref.id, ...payload, fecha: { seconds: Date.now() / 1000 } },
      ]);
      showSnackbar("¡Inscripción realizada!", "success");
    } catch (e) {
      console.error("Enroll error:", e);
      showSnackbar("No se pudo inscribir. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnenroll(instance) {
    if (!user) return;
    const { id: claseId, fechaStr } = instance;
    const reserva = reservas.find(
      (r) => r.claseId === claseId && r.claseFecha === fechaStr && r.userId === user.uid
    );
    if (!reserva) return;

    const esUsada = reserva.estado === "usado";

    Alert.alert(
      esUsada ? "Eliminar de tu vista" : "Cancelar inscripción",
      esUsada
        ? "¿Querés eliminar esta clase de tu historial? El gimnasio seguirá viéndola."
        : "¿Seguro que querés cancelar tu lugar en esta clase?",
      [
        { text: "No", style: "cancel" },
        {
          text: esUsada ? "Sí, eliminar" : "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              if (esUsada) {
                await updateDoc(doc(db, "reservas", reserva.id), { ocultaParaUsuario: true });
              } else {
                await deleteDoc(doc(db, "reservas", reserva.id));
              }
              setReservas((prev) => prev.filter((r) => r.id !== reserva.id));
              showSnackbar(esUsada ? "Eliminado de tu historial." : "Inscripción cancelada.", "success");
            } catch (e) {
              showSnackbar("No se pudo cancelar. Intentá de nuevo.");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  const instances = generateInstances(templates);
  const days      = groupByDate(instances);

  // ── Render a single class card ─────────────────────────────────────────────
  function renderInstance(instance) {
    const { id: claseId, fechaStr, actividad, horaInicio, horaFin, cupo, profesor, descripcion } = instance;
    const enrolled   = reservas.filter((r) => r.claseId === claseId && r.claseFecha === fechaStr).length;
    const isEnrolled = reservas.some((r) => r.claseId === claseId && r.claseFecha === fechaStr && r.userId === user?.uid);
    const isFull     = cupo && enrolled >= cupo;
    // Allow press even when plan is insufficient — handleEnroll gates it and shows upgrade alert.
    // Only disable when the class is full and the user isn't already enrolled.
    const canPress   = !busy && (isEnrolled || !isFull);

    return (
      <View key={`${claseId}-${fechaStr}`} style={styles.claseCard}>
        {/* Activity badge + spots */}
        <View style={styles.claseTop}>
          <View style={styles.actBadge}>
            <MaterialCommunityIcons name="dumbbell" size={12} color={COLORS.green} />
            <Text style={styles.actBadgeText}>{actividad}</Text>
          </View>
          {cupo ? (
            <Text style={[styles.cupoText, isFull && { color: COLORS.red }]}>
              {isFull ? "Completo" : `${enrolled}/${cupo} lugares`}
            </Text>
          ) : null}
        </View>

        {/* Time */}
        <Text style={styles.claseHorario}>{horaInicio} — {horaFin}</Text>

        {/* Professor / description */}
        {!!profesor    && <Text style={styles.claseMeta}>Prof. {profesor}</Text>}
        {!!descripcion && <Text style={styles.claseDesc} numberOfLines={2}>{descripcion}</Text>}

        {/* Enroll / unenroll button */}
        <TouchableOpacity
          style={[
            styles.enrollBtn,
            isEnrolled && styles.enrollBtnEnrolled,
            (!canEnroll || isFull) && !isEnrolled && styles.enrollBtnLocked,
          ]}
          onPress={() => isEnrolled ? handleUnenroll(instance) : handleEnroll(instance)}
          disabled={!canPress}
        >
          <MaterialCommunityIcons
            name={
              isEnrolled    ? "check-circle"        :
              !canEnroll    ? "lock-outline"         :
              isFull        ? "cancel"               :
                              "plus-circle-outline"
            }
            size={15}
            color={
              isEnrolled          ? COLORS.green     :
              (!canEnroll||isFull) ? COLORS.textMuted :
                                    COLORS.text
            }
          />
          <Text style={[
            styles.enrollBtnText,
            isEnrolled              && { color: COLORS.green     },
            (!canEnroll || isFull) && !isEnrolled && { color: COLORS.textMuted },
          ]}>
            {isEnrolled  ? "Inscripto · Cancelar"  :
             !canEnroll  ? "Requiere plan Platinum" :
             isFull      ? "Clase completa"         :
                           "Inscribirme"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{gymName}</Text>
        <Text style={styles.subtitle}>Clases</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.green} />
        </View>
      ) : templates.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Sin clases cargadas</Text>
          <Text style={styles.emptyText}>Este gimnasio todavía no tiene clases en el sistema.</Text>
        </View>
      ) : days.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="calendar-check-outline" size={48} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Sin clases próximas</Text>
          <Text style={styles.emptyText}>No hay clases programadas para los próximos 14 días.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {days.map((group) => (
            <View key={group.fechaStr}>
              <Text style={styles.dayHeader}>{group.displayDate}</Text>
              {group.items.map((inst) => renderInstance(inst))}
            </View>
          ))}
        </ScrollView>
      )}

      <Snackbar message={snackbar.message} type={snackbar.type} visible={snackbar.visible} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  scroll: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 50 },

  header:    { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },
  backBtn:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 18, alignSelf: "flex-start" },
  backText:  { color: COLORS.green, fontSize: 15 },
  title:     { color: COLORS.text,     fontSize: 24, fontWeight: "800" },
  subtitle:  { color: COLORS.textMuted, fontSize: 13, marginTop: 3 },

  dayHeader: {
    color: COLORS.green, fontSize: 14, fontWeight: "700",
    textTransform: "capitalize",
    marginTop: 14, marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  claseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16, padding: 14,
    marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  claseTop:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  actBadge:     {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#0a1f0e", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.greenDark,
  },
  actBadgeText: { color: COLORS.green, fontSize: 12, fontWeight: "700" },
  cupoText:     { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  claseHorario: { color: COLORS.text, fontSize: 17, fontWeight: "700", marginBottom: 4 },
  claseMeta:    { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  claseDesc:    { color: COLORS.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },

  enrollBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: 12, borderRadius: 10, paddingVertical: 10,
    backgroundColor: COLORS.greenDark,
  },
  enrollBtnEnrolled: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.green },
  enrollBtnLocked:   { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.border },
  enrollBtnText:     { color: COLORS.text, fontSize: 13, fontWeight: "600" },

  emptyTitle: { color: COLORS.text,     fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptyText:  { color: COLORS.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },

  snackbar: {
    position: "absolute", bottom: 30, left: 20, right: 20,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  snackbarErr: { backgroundColor: "#1f0a0a", borderWidth: 1, borderColor: COLORS.red   },
  snackbarOk:  { backgroundColor: "#0a1f0e", borderWidth: 1, borderColor: COLORS.green },
  snackbarIcon: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  snackbarText: { color: COLORS.text, fontSize: 14, flex: 1, lineHeight: 20 },
});
