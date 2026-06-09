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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, getDoc, getDocs, addDoc, setDoc, collection, query, where, serverTimestamp } from "firebase/firestore";
import QRCode from "react-native-qrcode-svg";
import { auth, db } from "../firebaseConfig";
import { canAccessGym } from "../utils/planes";

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

const PLAN_LABELS = { classic: "Classic", platinum: "Platinum", black: "Black" };
const PLAN_COLORS = { classic: "#64748b", platinum: "#8b5cf6", black: "#f59e0b" };

function RefreshBanner() {
  return (
    <View style={{ backgroundColor: "#22c55e", flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, gap: 8 }}>
      <ActivityIndicator color="#0f1520" size="small" />
      <Text style={{ color: '#0f1520', fontSize: 13, fontWeight: '700' }}>Actualizando...</Text>
    </View>
  );
}

export default function GymDetailScreen({ route, navigation }) {
  const { gymId } = route.params;

  const [loading, setLoading] = useState(true);
  const [gymData, setGymData] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userPlan, setUserPlan] = useState(null);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [reservando, setReservando] = useState(false);
  const [comprobante, setComprobante] = useState(null);
  const [resenas, setResenas] = useState([]);
  const [miRating, setMiRating] = useState(0);
  const [miComentario, setMiComentario] = useState("");
  const [tieneResena, setTieneResena] = useState(false);
  const [editandoResena, setEditandoResena] = useState(false);
  const [guardandoResena, setGuardandoResena] = useState(false);
  const [reporteModalVisible, setReporteModalVisible] = useState(false);
  const [reporteTexto, setReporteTexto] = useState("");
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
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
          const ud = userSnap.data();
          setUserRole(ud.rol);
          setUserPlan(ud.plan || null);
          const nombre = `${ud.nombre || ""} ${ud.apellido || ""}`.trim();
          setNombreUsuario(nombre || user?.email?.split("@")[0] || "");
        }

        const resenasSnap = await getDocs(collection(db, "gimnasios", gymId, "resenas"));
        const todasResenas = resenasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setResenas(todasResenas);
        if (user) {
          const mia = todasResenas.find((r) => r.userId === user.uid);
          if (mia) {
            setMiRating(mia.rating || 0);
            setMiComentario(mia.comentario || "");
            setTieneResena(true);
          }
        }
    } catch (error) {
      console.error("Error fetching gym details:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { if (gymId) fetchData(); }, [gymId]);

  const reservarPase = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const gymPlan = gymData?.planGimnasio || "classic";

    // No plan at all
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

    // Plan doesn't cover this gym
    if (!canAccessGym(userPlan, gymPlan)) {
      Alert.alert(
        "Plan insuficiente",
        `Este gimnasio requiere el plan ${PLAN_LABELS[gymPlan] || gymPlan} o superior. Tu plan actual es ${PLAN_LABELS[userPlan] || userPlan}.`,
        [
          { text: "Cerrar", style: "cancel" },
          { text: "Ver planes", onPress: () => navigation.navigate("Tabs", { screen: "PassTab" }) },
        ]
      );
      return;
    }

    setReservando(true);
    try {
      if (userPlan !== "black") {
        // Classic / Platinum: max 1 pass per day across ALL gyms.
        // Date filter is done client-side to avoid needing a composite Firestore index.
        const snap = await getDocs(query(
          collection(db, "reservas"),
          where("userId", "==", user.uid),
          where("tipo", "==", "pase")
        ));
        const todayISO = new Date().toISOString().slice(0, 10);
        const hasPassToday = snap.docs.some((d) => d.data().fechaISO === todayISO);
        if (hasPassToday) {
          Alert.alert("Límite diario alcanzado", "Solo podés usar 1 pase por día. Ya usaste tu pase de hoy.");
          return;
        }
      }
      // Black: no daily limit — allow multiple passes across all gyms

      const docRef = await addDoc(collection(db, "reservas"), {
        userId: user.uid,
        nombreUsuario,
        emailUsuario: user.email || "",
        tipo: "pase",
        gymId,
        nombreGimnasio: gymData?.nombreGimnasio || gymData?.nombre || "",
        fecha: serverTimestamp(),
        fechaISO: new Date().toISOString().slice(0, 10),
        estado: "pendiente",
        planUsuario: userPlan ? userPlan.toLowerCase() : "classic",
      });
      setComprobante({
        id: docRef.id,
        gymId,
        nombreGimnasio: gymData?.nombreGimnasio || gymData?.nombre || "Gimnasio",
        tipo: "pase",
        estado: "pendiente",
        fecha: new Date(),
      });
    } catch (e) {
      console.error("Error reservando pase:", e);
      Alert.alert("Error", e.message || "No se pudo realizar la reserva. Intentá de nuevo.");
    } finally {
      setReservando(false);
    }
  };

  const guardarResena = async () => {
    const user = auth.currentUser;
    if (!user || !miRating) return;
    setGuardandoResena(true);
    try {
      const payload = {
        userId: user.uid,
        nombreUsuario,
        rating: miRating,
        comentario: miComentario.trim(),
        fecha: serverTimestamp(),
        plan: userPlan ? (PLAN_LABELS[userPlan] || "Classic") : "Classic",
      };
      await setDoc(doc(db, "gimnasios", gymId, "resenas", user.uid), payload);
      setTieneResena(true);
      setEditandoResena(false);
      setResenas((prev) => {
        const resto = prev.filter((r) => r.userId !== user.uid);
        return [...resto, { id: user.uid, ...payload }];
      });
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar la reseña.");
    } finally {
      setGuardandoResena(false);
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

  const { descripcion, horarios, fotos = [] } = gymData;
  const nombre = gymData.nombreGimnasio || gymData.nombre || "Gimnasio";
  const esCliente = userRole === "usuario";
  const avgRating = resenas.length > 0
    ? resenas.reduce((sum, r) => sum + (r.rating || 0), 0) / resenas.length
    : null;
  const gymPlan = gymData?.planGimnasio || "classic";
  const canAccess = canAccessGym(userPlan, gymPlan);

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

  const handleEnviarReporte = async () => {
    if (!reporteTexto.trim()) return;
    setEnviandoReporte(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, "reportes_gimnasios"), {
        gymId,
        nombreGimnasio: gymData?.nombreGimnasio || "",
        uid: user?.uid || null,
        email: user?.email || null,
        mensaje: reporteTexto.trim(),
        creadoEn: serverTimestamp(),
        leido: false,
      });
      setReporteModalVisible(false);
      setReporteTexto("");
      Alert.alert("Reporte enviado", "Gracias por tu reporte. El gimnasio lo revisará a la brevedad.");
    } catch (e) {
      console.error("Error enviando reporte de gym:", e);
      Alert.alert("Error", "No se pudo enviar el reporte. Intentá de nuevo.");
    } finally {
      setEnviandoReporte(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      {refreshing && <RefreshBanner />}

      <Modal
        visible={!!comprobante}
        transparent
        animationType="fade"
        onRequestClose={() => setComprobante(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ticketContainer}>
            <View style={styles.ticketTop}>
              <MaterialCommunityIcons name="ticket-confirmation" size={40} color={COLORS.green} />
              <Text style={styles.ticketTitle}>¡Reserva confirmada!</Text>
              <Text style={styles.ticketGym}>{comprobante?.nombreGimnasio}</Text>
            </View>

            <View style={styles.ticketDivider}>
              <View style={styles.ticketNotch} />
              <View style={styles.ticketDash} />
              <View style={[styles.ticketNotch, { right: -14, left: undefined }]} />
            </View>

            <View style={styles.ticketBottom}>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Tipo</Text>
                <Text style={styles.ticketValue}>Pase libre</Text>
              </View>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Fecha</Text>
                <Text style={styles.ticketValue}>
                  {comprobante?.fecha?.toLocaleDateString("es-AR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </Text>
              </View>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Estado</Text>
                <View style={styles.ticketEstadoBadge}>
                  <Text style={styles.ticketEstadoText}>Activo</Text>
                </View>
              </View>
              <View style={[styles.ticketRow, { marginTop: 8 }]}>
                <Text style={styles.ticketLabel}>Código</Text>
                <Text style={styles.ticketCode}>
                  #{comprobante?.id?.slice(-8).toUpperCase()}
                </Text>
              </View>
            </View>

            {!!comprobante?.id && (
              <View style={styles.qrWrap}>
                <QRCode
                  value={JSON.stringify({ reservaId: comprobante.id, gymId: comprobante.gymId, tipo: "pase" })}
                  size={130}
                  backgroundColor="#152030"
                  color="#22c55e"
                />
              </View>
            )}

            <TouchableOpacity
              style={styles.ticketCloseBtn}
              onPress={() => setComprobante(null)}
            >
              <Text style={styles.ticketCloseBtnText}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor={COLORS.green}
            colors={[COLORS.green]}
          />
        }
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.green} />
          <Text style={styles.back}>Volver</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{nombre}</Text>
          {gymPlan && (
            <View style={[styles.planBadge, {
              backgroundColor: PLAN_COLORS[gymPlan] + "22",
              borderColor: PLAN_COLORS[gymPlan],
            }]}>
              <MaterialCommunityIcons name="star-circle-outline" size={13} color={PLAN_COLORS[gymPlan]} />
              <Text style={[styles.planBadgeText, { color: PLAN_COLORS[gymPlan] }]}>
                {PLAN_LABELS[gymPlan]}
              </Text>
            </View>
          )}
        </View>
        {avgRating !== null && (
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={16} color="#f59e0b" />
            <Text style={styles.ratingAvg}>{avgRating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({resenas.length} reseña{resenas.length !== 1 ? "s" : ""})</Text>
          </View>
        )}

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
              style={[
                styles.reserveButton,
                !canAccess && styles.reserveButtonLocked,
                reservando && styles.reserveButtonDisabled,
                { flex: 1 },
              ]}
              onPress={reservarPase}
              disabled={reservando}
            >
              <MaterialCommunityIcons
                name={canAccess ? "ticket-confirmation-outline" : "lock-outline"}
                size={20}
                color="#fff"
              />
              <Text style={styles.reserveButtonText}>
                {reservando
                  ? "Reservando..."
                  : canAccess
                    ? "Reservar pase"
                    : `Requiere plan ${PLAN_LABELS[gymPlan] || ""}`}
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

        {esCliente && (
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => navigation.navigate("ClassCalendar", { gymId, gymName: nombre, userPlan, nombreUsuario })}
          >
            <MaterialCommunityIcons name="calendar-month-outline" size={20} color={COLORS.green} />
            <Text style={styles.calendarButtonText}>Ver clases disponibles</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.green} />
          </TouchableOpacity>
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

        {/* Reseñas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reseñas</Text>

          {/* Formulario del usuario */}
          {esCliente && (
            <View style={styles.resenaForm}>
              {tieneResena && !editandoResena ? (
                <>
                  <Text style={styles.resenaFormLabel}>Tu reseña</Text>
                  <View style={styles.starsRow}>
                    {[1,2,3,4,5].map((i) => (
                      <MaterialCommunityIcons
                        key={i}
                        name={i <= miRating ? "star" : "star-outline"}
                        size={22}
                        color="#f59e0b"
                      />
                    ))}
                  </View>
                  {!!miComentario && (
                    <Text style={styles.resenaComentario}>{miComentario}</Text>
                  )}
                  <TouchableOpacity
                    style={styles.resenaEditarBtn}
                    onPress={() => setEditandoResena(true)}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={14} color={COLORS.green} />
                    <Text style={styles.resenaEditarBtnText}>Editar reseña</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.resenaFormLabel}>
                    {tieneResena ? "Editar tu reseña" : "Dejá tu reseña"}
                  </Text>
                  <View style={styles.starsRow}>
                    {[1,2,3,4,5].map((i) => (
                      <TouchableOpacity key={i} onPress={() => setMiRating(i)}>
                        <MaterialCommunityIcons
                          name={i <= miRating ? "star" : "star-outline"}
                          size={28}
                          color="#f59e0b"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.resenaInput}
                    placeholder="Comentario (opcional)"
                    placeholderTextColor={COLORS.textMuted}
                    value={miComentario}
                    onChangeText={setMiComentario}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.resenaActions}>
                    {tieneResena && (
                      <TouchableOpacity
                        style={styles.resenaCancelarBtn}
                        onPress={() => setEditandoResena(false)}
                      >
                        <Text style={styles.resenaCancelarText}>Cancelar</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[
                        styles.resenaGuardarBtn,
                        (!miRating || guardandoResena) && styles.resenaGuardarBtnDisabled,
                      ]}
                      onPress={guardarResena}
                      disabled={!miRating || guardandoResena}
                    >
                      <Text style={styles.resenaGuardarBtnText}>
                        {guardandoResena ? "Guardando..." : tieneResena ? "Actualizar" : "Publicar"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Lista de reseñas */}
          {resenas.length === 0 ? (
            <Text style={styles.resenaEmpty}>Todavía no hay reseñas.</Text>
          ) : (
            resenas
              .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0))
              .map((r) => (
                <View key={r.id} style={styles.resenaCard}>
                  <View style={styles.resenaCardHeader}>
                    <Text style={styles.resenaCardNombre}>{r.nombreUsuario || "Usuario"}</Text>
                    <View style={styles.starsRowSmall}>
                      {[1,2,3,4,5].map((i) => (
                        <MaterialCommunityIcons
                          key={i}
                          name={i <= r.rating ? "star" : "star-outline"}
                          size={14}
                          color="#f59e0b"
                        />
                      ))}
                    </View>
                  </View>
                  {!!r.comentario && (
                    <Text style={styles.resenaCardComentario}>{r.comentario}</Text>
                  )}
                  {r.fecha?.seconds && (
                    <Text style={styles.resenaCardFecha}>
                      {new Date(r.fecha.seconds * 1000).toLocaleDateString("es-AR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                      })}
                    </Text>
                  )}
                  {!!r.respuestaGym && r.respuestaGym.trim() !== "" && (
                    <View style={styles.resenaRespuestaBox}>
                      <Text style={styles.resenaRespuestaTitulo}>Respuesta del gimnasio:</Text>
                      <Text style={styles.resenaRespuestaTexto}>{r.respuestaGym}</Text>
                    </View>
                  )}
                </View>
              ))
          )}
        </View>

        {/* Botón reportar problema */}
        {userRole === "usuario" && (
          <TouchableOpacity
            style={styles.reportarBtn}
            onPress={() => setReporteModalVisible(true)}
          >
            <MaterialCommunityIcons name="flag-outline" size={16} color={COLORS.error} />
            <Text style={styles.reportarBtnText}>Reportar un problema con este gimnasio</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Modal reporte de gym */}
      <Modal
        visible={reporteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReporteModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.reporteOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.reporteCard}>
            <Text style={styles.reporteTitulo}>Reportar un problema</Text>
            <Text style={styles.reporteSubtitulo}>
              Describí el problema con <Text style={{ color: COLORS.text, fontWeight: "700" }}>{gymData?.nombreGimnasio}</Text>. El gimnasio recibirá tu reporte.
            </Text>
            <TextInput
              style={styles.reporteInput}
              value={reporteTexto}
              onChangeText={setReporteTexto}
              placeholder="Describí el problema acá..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.reporteCharCount}>{reporteTexto.length}/1000</Text>
            <View style={styles.reporteActions}>
              <TouchableOpacity
                style={styles.reporteCancelarBtn}
                onPress={() => { setReporteModalVisible(false); setReporteTexto(""); }}
              >
                <Text style={styles.reporteCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reporteEnviarBtn, (!reporteTexto.trim() || enviandoReporte) && styles.reporteEnviarBtnDisabled]}
                onPress={handleEnviarReporte}
                disabled={!reporteTexto.trim() || enviandoReporte}
              >
                {enviandoReporte ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.reporteEnviarText}>Enviar reporte</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "800" },
  planBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
  },
  planBadgeText: { fontSize: 12, fontWeight: "700" },
  reserveButtonLocked: { backgroundColor: "#374151" },
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
  calendarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  calendarButtonText: { color: COLORS.green, fontSize: 15, fontWeight: "700", flex: 1 },

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

  claseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  claseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  claseHorario: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  claseMeta: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  claseDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  claseCupoBadge: {
    backgroundColor: "#0a2e18",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  claseCupoBadgeLleno: {
    backgroundColor: "#2a0a0a",
    borderColor: COLORS.error,
  },
  claseCupo: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "600",
  },
  claseCupoLleno: {
    color: COLORS.error,
  },
  claseReservarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  claseReservarBtnLocked: {
    backgroundColor: "#374151",
  },
  claseReservarBtnDisabled: {
    opacity: 0.6,
  },
  claseReservarBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 20,
    marginTop: -12,
  },
  ratingAvg: { color: "#f59e0b", fontWeight: "700", fontSize: 15 },
  ratingCount: { color: COLORS.textMuted, fontSize: 13 },

  resenaForm: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  resenaFormLabel: { color: COLORS.textMuted, fontSize: 13, marginBottom: 10 },
  starsRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  starsRowSmall: { flexDirection: "row", gap: 2 },
  resenaComentario: { color: COLORS.textMuted, fontSize: 13, marginBottom: 10 },
  resenaEditarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  resenaEditarBtnText: { color: COLORS.green, fontSize: 13, fontWeight: "600" },
  resenaInput: {
    backgroundColor: "#0d1824",
    color: COLORS.text,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 72,
    fontSize: 14,
    marginBottom: 12,
  },
  resenaActions: { flexDirection: "row", gap: 10 },
  resenaCancelarBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resenaCancelarText: { color: COLORS.textMuted, fontSize: 14 },
  resenaGuardarBtn: {
    flex: 1,
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  resenaGuardarBtnDisabled: { opacity: 0.4 },
  resenaGuardarBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  resenaEmpty: { color: COLORS.textMuted, fontSize: 14, marginBottom: 8 },
  resenaCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  resenaCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  resenaCardNombre: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  resenaCardComentario: { color: COLORS.textMuted, fontSize: 13, marginBottom: 4, lineHeight: 18 },
  resenaCardFecha: { color: COLORS.textMuted, fontSize: 11 },
  resenaRespuestaBox: {
    marginTop: 10,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.2)",
  },
  resenaRespuestaTitulo: { color: COLORS.green, fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  resenaRespuestaTexto: { color: COLORS.text, fontSize: 13, lineHeight: 18 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  ticketContainer: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ticketTop: {
    alignItems: "center",
    padding: 28,
    gap: 8,
  },
  ticketTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
  },
  ticketGym: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  ticketDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 0,
    position: "relative",
  },
  ticketNotch: {
    position: "absolute",
    left: -14,
    top: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ticketDash: {
    borderTopWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    flex: 1,
    marginHorizontal: 14,
  },
  ticketBottom: {
    padding: 24,
    gap: 12,
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  ticketValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  ticketEstadoBadge: {
    backgroundColor: "#0a2e18",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  ticketEstadoText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "700",
  },
  ticketCode: {
    color: COLORS.green,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
  },
  ticketCloseBtn: {
    margin: 24,
    marginTop: 0,
    backgroundColor: COLORS.green,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ticketCloseBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  reportarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  reportarBtnText: { color: COLORS.error, fontSize: 13, fontWeight: "600" },

  reporteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  reporteCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reporteTitulo: { color: COLORS.text, fontSize: 18, fontWeight: "800", marginBottom: 6 },
  reporteSubtitulo: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  reporteInput: {
    backgroundColor: "#0f1520",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 14,
    minHeight: 110,
    textAlignVertical: "top",
  },
  reporteCharCount: { color: COLORS.textMuted, fontSize: 11, textAlign: "right", marginTop: 4, marginBottom: 14 },
  reporteActions: { flexDirection: "row", gap: 10 },
  reporteCancelarBtn: {
    flex: 1, paddingVertical: 13,
    alignItems: "center", borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  reporteCancelarText: { color: COLORS.textMuted, fontSize: 14, fontWeight: "600" },
  reporteEnviarBtn: {
    flex: 2, backgroundColor: COLORS.error,
    paddingVertical: 13, alignItems: "center",
    borderRadius: 12,
  },
  reporteEnviarBtnDisabled: { opacity: 0.4 },
  reporteEnviarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
