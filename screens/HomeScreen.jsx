import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, orderBy, getDocs, deleteDoc, updateDoc, limit } from 'firebase/firestore';
import QRCode from 'react-native-qrcode-svg';
import { auth, db } from '../firebaseConfig';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const COLORS = {
  bg: '#0f1520',
  card: '#152030',
  cardDark: '#12191f',
  green: '#22c55e',
  greenDark: '#16a34a',
  border: '#1e2a36',
  text: '#ffffff',
  textMuted: '#6b7f95',
  textSecondary: '#94a3b8',
  error: '#ef4444',
};

const PLANES = {
  classic:  { nombre: 'Classic',  descripcion: 'Acceso a gimnasios básicos.' },
  platinum: { nombre: 'Platinum', descripcion: 'Acceso a gimnasios premium y clases grupales.' },
  black:    { nombre: 'Black',    descripcion: 'Acceso ilimitado a toda la red, incluyendo spa y nutrición.' },
};

const mockData = {
  reservations: [
    {
      id: '1',
      tag: 'Hoy',
      name: 'Crossfit',
      time: '18:00hs',
      gym: 'GymFit',
      address: 'Av. Corrientes 1234',
    },
  ],
  recentVisit: {
    gym: 'GymFit',
    timeAgo: 'Hace 2 horas',
  },
};

const OCCUPANCY = [
  { label: 'Vacío',     emoji: '😄', color: '#14532d' },
  { label: 'Tranquilo', emoji: '🙂', color: '#14532d' },
  { label: 'Moderado',  emoji: '😐', color: '#1e3a1a' },
  { label: 'Lleno',     emoji: '😟', color: '#3a2a10' },
  { label: 'Muy lleno', emoji: '😰', color: '#3a1010' },
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const [selectedOccupancy, setSelectedOccupancy] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [reservas, setReservas] = useState([]);
  const [loadingReservas, setLoadingReservas] = useState(true);
  const [comprobante, setComprobante] = useState(null);
  const [feedbackPendiente, setFeedbackPendiente] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // useFocusEffect recarga los datos cada vez que esta pestaña queda visible,
  // así el plan aparece actualizado después de comprarlo en PassScreen.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadingPlan(true);

      const fetchUserData = async () => {
        try {
          const user = auth.currentUser;
          if (!user) return;

          const snap = await getDoc(doc(db, 'usuarios', user.uid));
          if (snap.exists() && active) {
            const data = snap.data();
            setPlanId(data.plan || null);
            const nombre = (data.nombre || data.apellido)
              ? `${data.nombre || ''} ${data.apellido || ''}`.trim()
              : (user.email || '').split('@')[0];
            setNombreUsuario(nombre);
          }
        } catch (e) {
          console.log('HomeScreen: no se pudo leer usuario', e?.code || e?.message);
        } finally {
          if (active) setLoadingPlan(false);
        }

        try {
          const user = auth.currentUser;
          if (!user) return;
          const reservasSnap = await getDocs(query(
            collection(db, 'reservas'),
            where('userId', '==', user.uid),
            limit(50)
          ));

          const now = new Date();
          const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
          const todayStr = now.toISOString().slice(0, 10);

          const isExpiredRes = (r) => {
            if (r.tipo === 'pase') {
              if (!r.fecha?.seconds) return false;
              return new Date(r.fecha.seconds * 1000) < todayMidnight;
            }
            if (r.tipo === 'clase') {
              if (!r.claseFecha) return false;
              if (r.claseFecha < todayStr) return true;
              if (r.claseFecha === todayStr && r.horaFin) {
                const [h, m] = r.horaFin.split(':').map(Number);
                const [y, mo, d] = todayStr.split('-').map(Number);
                return new Date(y, mo - 1, d, h, m, 0, 0) <= now;
              }
              return false;
            }
            return false;
          };

          // Fire-and-forget deletion of expired docs (don't block the UI)
          reservasSnap.docs
            .filter(d => isExpiredRes(d.data()))
            .forEach(d => deleteDoc(doc(db, 'reservas', d.id)).catch(() => {}));

          if (active) {
            const lista = reservasSnap.docs
              .filter(d => !isExpiredRes(d.data()))
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
            setReservas(lista);
            setFeedbackPendiente(lista.filter(r => r.estado === 'usado' && !r.feedbackDado));
          }
        } catch (e) {
          console.log('HomeScreen: error cargando reservas:', e?.code, e?.message);
        } finally {
          if (active) setLoadingReservas(false);
        }
      };

      // Load in-app notifications
      const fetchNotificaciones = async () => {
        try {
          const user = auth.currentUser;
          if (!user) return;
          const snap = await getDocs(query(
            collection(db, 'usuarios', user.uid, 'notificaciones'),
            orderBy('creadoEn', 'desc'),
            limit(30)
          ));
          if (active) {
            setNotificaciones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        } catch (e) {
          console.log('HomeScreen: error cargando notificaciones:', e?.code, e?.message);
        }
      };

      fetchUserData();
      fetchNotificaciones();
      return () => { active = false; };
    }, [])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const [snap, reservasSnap, notifSnap] = await Promise.all([
        getDoc(doc(db, 'usuarios', user.uid)),
        getDocs(query(collection(db, 'reservas'), where('userId', '==', user.uid), limit(50))),
        getDocs(query(collection(db, 'usuarios', user.uid, 'notificaciones'), orderBy('creadoEn', 'desc'), limit(30))),
      ]);

      if (snap.exists()) {
        const data = snap.data();
        setPlanId(data.plan || null);
        const nombre = (data.nombre || data.apellido)
          ? `${data.nombre || ''} ${data.apellido || ''}`.trim()
          : (user.email || '').split('@')[0];
        setNombreUsuario(nombre);
      }

      const now = new Date();
      const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
      const todayStr = now.toISOString().slice(0, 10);
      const isExpiredRes = (r) => {
        if (r.tipo === 'pase') return r.fecha?.seconds ? new Date(r.fecha.seconds * 1000) < todayMidnight : false;
        if (r.tipo === 'clase') {
          if (!r.claseFecha) return false;
          if (r.claseFecha < todayStr) return true;
          if (r.claseFecha === todayStr && r.horaFin) {
            const [h, m] = r.horaFin.split(':').map(Number);
            const [y, mo, d] = todayStr.split('-').map(Number);
            return new Date(y, mo - 1, d, h, m, 0, 0) <= now;
          }
        }
        return false;
      };
      const lista = reservasSnap.docs
        .filter(d => !isExpiredRes(d.data()))
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
      setReservas(lista);
      setFeedbackPendiente(lista.filter(r => r.estado === 'usado' && !r.feedbackDado));

      setNotificaciones(notifSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.log('HomeScreen refresh error:', e?.code, e?.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const planData = planId ? PLANES[planId] : null;

  const eliminarReserva = (reservaId, nombre) => {
    Alert.alert(
      "Cancelar reserva",
      `¿Seguro que querés cancelar la reserva de ${nombre}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "reservas", reservaId));
              setReservas((prev) => prev.filter((r) => r.id !== reservaId));
            } catch (e) {
              console.error("Error eliminando reserva:", e);
              Alert.alert("Error", e.message || "No se pudo cancelar la reserva.");
            }
          },
        },
      ]
    );
  };

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  const handleOpenNotificaciones = () => {
    setNotifModalVisible(true);
    // Mark all unread as read locally and in Firestore (fire-and-forget)
    const user = auth.currentUser;
    if (!user) return;
    notificaciones
      .filter(n => !n.leida)
      .forEach(n =>
        updateDoc(doc(db, 'usuarios', user.uid, 'notificaciones', n.id), { leida: true })
          .catch(() => {})
      );
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
  };

  const handleDeleteNotif = async (notifId) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'usuarios', user.uid, 'notificaciones', notifId));
      setNotificaciones(prev => prev.filter(n => n.id !== notifId));
    } catch (e) {
      console.log('Error eliminando notificación:', e?.message);
    }
  };

  const handleDeleteAllNotifs = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await Promise.all(
        notificaciones.map(n => deleteDoc(doc(db, 'usuarios', user.uid, 'notificaciones', n.id)))
      );
      setNotificaciones([]);
    } catch (e) {
      console.log('Error eliminando notificaciones:', e?.message);
    }
  };

  const handleFeedback = async (ocupacion) => {
    const reserva = feedbackPendiente[0];
    if (!reserva) return;
    try {
      await updateDoc(doc(db, 'reservas', reserva.id), {
        feedbackDado: true,
        ocupacion,
      });
      setFeedbackPendiente(prev => prev.slice(1));
      setSelectedOccupancy(null);
    } catch (e) {
      console.error('Error saving feedback:', e);
    }
  };

  const skipFeedback = () => {
    setFeedbackPendiente(prev => prev.slice(1));
    setSelectedOccupancy(null);
  };

  const esClaseComp = comprobante?.tipo === 'clase';
  const fechaComp = comprobante?.fecha?.seconds
    ? new Date(comprobante.fecha.seconds * 1000).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* ── Notification panel ─────────────────────────────────────────────── */}
      <Modal
        visible={notifModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotifModalVisible(false)}
      >
        <View style={styles.notifOverlay}>
          <View style={styles.notifPanel}>
            <View style={styles.notifPanelHeader}>
              <Text style={styles.notifPanelTitle}>Notificaciones</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {notificaciones.length > 0 && (
                  <TouchableOpacity onPress={handleDeleteAllNotifs}>
                    <Text style={styles.notifClearAllText}>Eliminar todas</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setNotifModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {notificaciones.length === 0 ? (
              <View style={styles.notifEmpty}>
                <MaterialCommunityIcons name="bell-off-outline" size={44} color={COLORS.textMuted} />
                <Text style={styles.notifEmptyText}>Sin notificaciones</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {notificaciones.map(n => {
                  const esCancel = n.tipo === 'clase_cancelada';
                  return (
                    <View key={n.id} style={[styles.notifItem, !n.leida && styles.notifItemUnread]}>
                      <View style={[styles.notifIconCircle, { backgroundColor: esCancel ? '#2a0a0a' : '#0a1f0e' }]}>
                        <MaterialCommunityIcons
                          name={esCancel ? 'calendar-remove' : 'headset'}
                          size={18}
                          color={esCancel ? COLORS.error : COLORS.green}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notifTitulo}>{n.titulo}</Text>
                        <Text style={styles.notifMensaje}>{n.mensaje}</Text>
                        {!!n.creadoEn?.seconds && (
                          <Text style={styles.notifFecha}>
                            {new Date(n.creadoEn.seconds * 1000).toLocaleDateString('es-AR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteNotif(n.id)}
                        style={styles.notifDeleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={17} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Comprobante modal ───────────────────────────────────────────────── */}
      <Modal
        visible={!!comprobante}
        transparent
        animationType="fade"
        onRequestClose={() => setComprobante(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ticketContainer}>
            <View style={styles.ticketTop}>
              <MaterialCommunityIcons
                name={esClaseComp ? 'account-group' : 'ticket-confirmation'}
                size={40}
                color={COLORS.green}
              />
              <Text style={styles.ticketTitle}>Comprobante de reserva</Text>
              <Text style={styles.ticketGym}>
                {esClaseComp
                  ? (comprobante?.actividad || comprobante?.nombreClase || 'Clase')
                  : comprobante?.nombreGimnasio}
              </Text>
            </View>

            <View style={styles.ticketDivider}>
              <View style={styles.ticketNotch} />
              <View style={[styles.ticketNotch, { right: -14, left: undefined }]} />
            </View>

            <View style={styles.ticketBottom}>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Tipo</Text>
                <Text style={styles.ticketValue}>{esClaseComp ? 'Clase grupal' : 'Pase libre'}</Text>
              </View>
              {esClaseComp && comprobante?.nombreGimnasio ? (
                <View style={styles.ticketRow}>
                  <Text style={styles.ticketLabel}>Gimnasio</Text>
                  <Text style={styles.ticketValue}>{comprobante.nombreGimnasio}</Text>
                </View>
              ) : null}
              {esClaseComp && comprobante?.diaHora ? (
                <View style={styles.ticketRow}>
                  <Text style={styles.ticketLabel}>Horario</Text>
                  <Text style={styles.ticketValue}>{comprobante.diaHora}</Text>
                </View>
              ) : null}
              {fechaComp ? (
                <View style={styles.ticketRow}>
                  <Text style={styles.ticketLabel}>Reservado</Text>
                  <Text style={styles.ticketValue}>{fechaComp}</Text>
                </View>
              ) : null}
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Estado</Text>
                <View style={[
                  styles.ticketEstadoBadge,
                  comprobante?.estado === 'usado' && styles.ticketEstadoBadgeUsado,
                ]}>
                  <Text style={[
                    styles.ticketEstadoText,
                    comprobante?.estado === 'usado' && styles.ticketEstadoTextUsado,
                  ]}>
                    {comprobante?.estado === 'usado' ? 'Usado' : 'Activo'}
                  </Text>
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
                  value={JSON.stringify({ reservaId: comprobante.id, gymId: comprobante.gymId, tipo: comprobante.tipo || 'pase' })}
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
              <Text style={styles.ticketCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.green} colors={[COLORS.green]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>Buenos días</Text>
            <Text style={styles.greetingName}>
              Hola{nombreUsuario ? `, ${nombreUsuario}` : ''}!
            </Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={handleOpenNotificaciones}>
            <Ionicons name="notifications-outline" size={18} color={COLORS.textSecondary} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tarjeta de plan */}
        {loadingPlan ? (
          <View style={[styles.planCard, styles.planCardLoading]}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : planData ? (
          <View style={styles.planCard}>
            <View style={styles.planBadge}>
              <MaterialCommunityIcons name="star-four-points" size={10} color="#d1fae5" />
              <Text style={styles.planBadgeText}>Plan Activo</Text>
            </View>
            <View style={styles.planIconTop}>
              <MaterialCommunityIcons name="dumbbell" size={20} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={styles.planName}>{planData.nombre}</Text>
            <Text style={styles.planDesc}>{planData.descripcion}</Text>
            <TouchableOpacity
              style={styles.planBtn}
              onPress={() => navigation.navigate('PassTab')}
            >
              <Text style={styles.planBtnText}>Ver detalles del plan</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.planCard, styles.planCardEmpty]}>
            <View style={styles.planIconTop}>
              <MaterialCommunityIcons name="dumbbell" size={20} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={styles.planEmptyTitle}>Sin plan activo</Text>
            <Text style={styles.planEmptyDesc}>
              Elegí un plan para comenzar a usar GymPass.
            </Text>
            <TouchableOpacity
              style={styles.planBtn}
              onPress={() => navigation.navigate('PassTab')}
            >
              <Text style={styles.planBtnText}>Elegir plan</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Próximas reservas */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mis Reservas</Text>
        </View>

        {loadingReservas ? (
          <ActivityIndicator color={COLORS.green} style={{ marginBottom: 16 }} />
        ) : reservas.length === 0 ? (
          <View style={styles.reservationCard}>
            <View style={styles.resIcon}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={22} color={COLORS.textMuted} />
            </View>
            <View style={styles.resBody}>
              <Text style={[styles.resName, { color: COLORS.textMuted }]}>Sin reservas todavía</Text>
              <Text style={styles.resDetail}>Explorá gimnasios y reservá tu lugar</Text>
            </View>
          </View>
        ) : (
          reservas.map((res) => {
            const fecha = res.fecha?.seconds
              ? new Date(res.fecha.seconds * 1000).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : '';
            const esClase = res.tipo === 'clase';
            return (
              <TouchableOpacity key={res.id} style={styles.reservationCard} onPress={() => setComprobante(res)} activeOpacity={0.75}>
                <View style={styles.resIcon}>
                  <MaterialCommunityIcons
                    name={esClase ? 'account-group' : 'ticket-confirmation-outline'}
                    size={22}
                    color={COLORS.green}
                  />
                </View>
                <View style={styles.resBody}>
                  <View style={styles.resTagWrapper}>
                    <Text style={styles.resTag}>{esClase ? 'Clase' : 'Pase'}</Text>
                  </View>
                  <Text style={styles.resName}>
                    {esClase ? (res.actividad || res.nombreClase || 'Clase') : res.nombreGimnasio}
                  </Text>
                  {esClase && res.nombreGimnasio ? (
                    <Text style={styles.resDetail}>{res.nombreGimnasio}</Text>
                  ) : null}
                  {!esClase ? null : res.diaHora ? (
                    <Text style={styles.resDetail}>{res.diaHora}</Text>
                  ) : null}
                  {fecha ? (
                    <View style={styles.resLoc}>
                      <Ionicons name="calendar-outline" size={10} color={COLORS.textMuted} />
                      <Text style={styles.resLocText}>Reservado el {fecha}</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => eliminarReserva(res.id, esClase ? (res.actividad || res.nombreClase || 'Clase') : res.nombreGimnasio)}
                  style={styles.deleteBtn}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.error} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}

        {/* Feedback ocupación — only shown when there's a validated reservation pending feedback */}
        {feedbackPendiente.length > 0 && (() => {
          const fb = feedbackPendiente[0];
          const esClaseFb = fb.tipo === 'clase';
          return (
            <View style={styles.feedbackCard}>
              <View style={styles.fbHeader}>
                <View style={styles.fbIconWrap}>
                  <Ionicons name="location" size={16} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fbTitle}>
                    {esClaseFb
                      ? `Clase: ${fb.actividad || 'Clase grupal'}`
                      : `Pase: ${fb.nombreGimnasio || 'Gimnasio'}`}
                  </Text>
                  <Text style={styles.fbTime}>{fb.nombreGimnasio}</Text>
                </View>
              </View>
              <Text style={styles.fbQuestion}>¿Qué tan lleno estaba el gimnasio?</Text>
              <View style={styles.fbOptions}>
                {OCCUPANCY.map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.fbOption}
                    onPress={() => setSelectedOccupancy(i)}
                  >
                    <View style={[
                      styles.fbEmoji,
                      { backgroundColor: opt.color },
                      selectedOccupancy === i && styles.fbEmojiSelected,
                    ]}>
                      <Text style={{ fontSize: 18 }}>{opt.emoji}</Text>
                    </View>
                    <Text style={[
                      styles.fbLabel,
                      selectedOccupancy === i && { color: COLORS.green },
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={styles.fbSkipBtn}
                  onPress={skipFeedback}
                >
                  <Text style={styles.fbSkipBtnText}>Saltar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fbSendBtn, selectedOccupancy === null && { opacity: 0.4 }]}
                  onPress={() => selectedOccupancy !== null && handleFeedback(selectedOccupancy)}
                  disabled={selectedOccupancy === null}
                >
                  <Text style={styles.fbSendBtnText}>Enviar</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* Atajos */}
        <Text style={styles.atajoTitle}>Atajos de Exploración</Text>
        <View style={styles.atajoGrid}>
          <TouchableOpacity
            style={styles.atajoCard}
            onPress={() => navigation.navigate('Map')}
          >
            <View style={[styles.atajoIcon, { backgroundColor: '#1a2a3a' }]}>
              <Ionicons name="location-outline" size={18} color={COLORS.green} />
            </View>
            <Text style={styles.atajoLabel}>Buscar cercanos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.atajoCard}>
            <View style={[styles.atajoIcon, { backgroundColor: '#1e2a1a' }]}>
              <MaterialCommunityIcons name="dumbbell" size={18} color={COLORS.green} />
            </View>
            <Text style={styles.atajoLabel}>Filtrar por actividad</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: COLORS.bg 
  },
  scroll: { 
    flex: 1 
  },
  content: { 
    padding: 20, 
    paddingBottom: 32 
  },

  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 20, 
    marginTop: 20 
  },
  greetingSub: { 
    fontSize: 12, 
    color: COLORS.textMuted, 
    marginBottom: 2 
  },
  greetingName: { 
    fontSize: 26, 
    fontWeight: '700', 
    color: COLORS.text, 
    letterSpacing: -0.5 
  },
  notifBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18,
    backgroundColor: '#1a2535',
    borderWidth: 1, 
    borderColor: '#2a3a4e', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },

  planCard: { 
    backgroundColor: COLORS.greenDark, 
    borderRadius: 18, 
    padding: 18, 
    marginBottom: 24 
  },
  planCardLoading: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    minHeight: 120 
  },
  planCardEmpty: { 
    backgroundColor: '#1a2535', 
    borderWidth: 1, 
    borderColor: '#2a3a4e' 
  },
  planBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 5, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 20, 
    paddingVertical: 3, 
    paddingHorizontal: 10, 
    alignSelf: 'flex-start', 
    marginBottom: 6 
  },
  planBadgeText: { 
    fontSize: 11, 
    color: '#d1fae5' 
  },
  planIconTop: { 
    position: 'absolute', 
    top: 14, 
    right: 16, 
    width: 38, 
    height: 38, 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  planName: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: '#fff', 
    marginBottom: 6 
  },
  planDesc: { 
    fontSize: 12, 
    color: '#bbf7d0', 
    marginBottom: 14 
  },
  planEmptyTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: COLORS.textSecondary, 
    marginBottom: 6, 
    marginTop: 4 
  },
  planEmptyDesc: {
  fontSize: 13,
  color: COLORS.textMuted,
  marginBottom: 14,
},
planBtn: {
  backgroundColor: 'rgba(255,255,255,0.18)',
  borderRadius: 10,
  paddingVertical: 10,
  paddingHorizontal: 16,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
},
planBtnText: {
  color: '#fff',
  fontSize: 13,
  fontWeight: '500',
},

sectionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
},
sectionTitle: {
  fontSize: 16,
  fontWeight: '700',
  color: COLORS.text,
},
seeAll: {
  fontSize: 12,
  color: COLORS.green,
  fontWeight: '500',
},

reservationCard: {
  backgroundColor: COLORS.card,
  borderRadius: 14,
  padding: 14,
  marginBottom: 12,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  borderWidth: 1,
  borderColor: COLORS.border,
},
resIcon: {
  width: 44,
  height: 44,
  backgroundColor: '#1e3a28',
  borderRadius: 12,
  alignItems: 'center',
  justifyContent: 'center',
},
resBody: {
  flex: 1,
},
resTagWrapper: {
  marginBottom: 3,
},
resTag: {
  backgroundColor: COLORS.greenDark,
  color: '#fff',
  fontSize: 10,
  fontWeight: '600',
  borderRadius: 6,
  paddingVertical: 2,
  paddingHorizontal: 7,
  alignSelf: 'flex-start',
},
resName: {
  fontSize: 15,
  fontWeight: '700',
  color: COLORS.text,
  marginBottom: 1,
},
resDetail: {
  fontSize: 11,
  color: COLORS.textMuted,
},
resLoc: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  marginTop: 2,
},
resLocText: {
  fontSize: 11,
  color: COLORS.textMuted,
},
resCode: {
  fontSize: 11,
  color: COLORS.textMuted,
  fontWeight: '700',
  letterSpacing: 1,
  marginTop: 3,
},
deleteBtn: {
  padding: 6,
},
verBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  backgroundColor: '#1e2e40',
  borderWidth: 1,
  borderColor: '#2a3d52',
  borderRadius: 10,
  paddingVertical: 7,
  paddingHorizontal: 12,
},
verBtnText: {
  fontSize: 12,
  color: COLORS.textSecondary,
},

feedbackCard: {
  backgroundColor: COLORS.cardDark,
  borderRadius: 14,
  padding: 14,
  marginBottom: 24,
  borderWidth: 1,
  borderColor: COLORS.border,
},
fbHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  marginBottom: 2,
},
fbIconWrap: {
  width: 34,
  height: 34,
  backgroundColor: 'rgba(194,120,0,0.12)',
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
},
fbTitle: {
  fontSize: 13,
  fontWeight: '600',
  color: '#e2e8f0',
},
fbTime: {
  fontSize: 11,
  color: '#4a6070',
},
fbQuestion: {
  fontSize: 13,
  color: '#8fa3b0',
  marginVertical: 10,
},
fbOptions: {
  flexDirection: 'row',
  justifyContent: 'space-between',
},
fbOption: {
  alignItems: 'center',
  gap: 4,
  flex: 1,
},
fbEmoji: {
  width: 38,
  height: 38,
  borderRadius: 19,
  alignItems: 'center',
  justifyContent: 'center',
},
fbEmojiSelected: {
  borderWidth: 2,
  borderColor: COLORS.green,
},
fbLabel: {
  fontSize: 10,
  color: '#5d7a8a',
  textAlign: 'center',
},

atajoTitle: {
  fontSize: 16,
  fontWeight: '700',
  color: COLORS.text,
  marginBottom: 12,
},
atajoGrid: {
  flexDirection: 'row',
  gap: 10,
},
atajoCard: {
  flex: 1,
  backgroundColor: COLORS.card,
  borderRadius: 14,
  padding: 16,
  alignItems: 'center',
  gap: 8,
  borderWidth: 1,
  borderColor: COLORS.border,
},
atajoIcon: {
  width: 36,
  height: 36,
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
},
atajoLabel: {
  fontSize: 12,
  color: COLORS.textSecondary,
  textAlign: 'center',
  fontWeight: '500',
},

modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.7)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
},
ticketContainer: {
  width: '100%',
  backgroundColor: COLORS.card,
  borderRadius: 20,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: COLORS.border,
},
ticketTop: {
  alignItems: 'center',
  padding: 28,
  gap: 8,
},
ticketTitle: {
  color: COLORS.text,
  fontSize: 20,
  fontWeight: '800',
  marginTop: 4,
},
ticketGym: {
  color: COLORS.textMuted,
  fontSize: 14,
  textAlign: 'center',
},
ticketDivider: {
  height: 1,
  backgroundColor: COLORS.border,
  position: 'relative',
},
ticketNotch: {
  position: 'absolute',
  left: -14,
  top: -14,
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: COLORS.bg,
  borderWidth: 1,
  borderColor: COLORS.border,
},
ticketBottom: {
  padding: 24,
  gap: 12,
},
ticketRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
ticketLabel: {
  color: COLORS.textMuted,
  fontSize: 13,
},
ticketValue: {
  color: COLORS.text,
  fontSize: 13,
  fontWeight: '600',
},
ticketEstadoBadge: {
  backgroundColor: '#0a2e18',
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 3,
  borderWidth: 1,
  borderColor: '#22c55e',
},
ticketEstadoText: {
  color: '#22c55e',
  fontSize: 12,
  fontWeight: '700',
},
ticketEstadoBadgeUsado: {
  backgroundColor: '#2e0a0a',
  borderColor: '#ef4444',
},
ticketEstadoTextUsado: {
  color: '#ef4444',
},
ticketCode: {
  color: COLORS.green,
  fontSize: 16,
  fontWeight: '800',
  letterSpacing: 2,
},
ticketCloseBtn: {
  margin: 24,
  marginTop: 0,
  backgroundColor: COLORS.greenDark,
  borderRadius: 14,
  paddingVertical: 14,
  alignItems: 'center',
},
ticketCloseBtnText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '700',
},
qrWrap: {
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 16,
  borderTopWidth: 1,
  borderTopColor: COLORS.border,
},
fbSkipBtn: {
  flex: 1,
  borderRadius: 10,
  paddingVertical: 10,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: COLORS.border,
},
fbSkipBtnText: {
  color: COLORS.textMuted,
  fontSize: 13,
  fontWeight: '600',
},
fbSendBtn: {
  flex: 2,
  backgroundColor: COLORS.greenDark,
  borderRadius: 10,
  paddingVertical: 10,
  alignItems: 'center',
},
fbSendBtnText: {
  color: '#fff',
  fontSize: 13,
  fontWeight: '700',
},

// ── Notification badge on bell ──────────────────────────────────────────────
notifBadge: {
  position: 'absolute',
  top: -5,
  right: -5,
  backgroundColor: COLORS.error,
  borderRadius: 10,
  minWidth: 18,
  height: 18,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 3,
},
notifBadgeText: {
  color: '#fff',
  fontSize: 10,
  fontWeight: '800',
},

// ── Notification panel modal ───────────────────────────────────────────────
notifOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.6)',
  justifyContent: 'flex-end',
},
notifPanel: {
  backgroundColor: COLORS.card,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  borderTopWidth: 1,
  borderColor: COLORS.border,
  maxHeight: '75%',
  paddingBottom: 30,
},
notifPanelHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 22,
  paddingVertical: 18,
  borderBottomWidth: 1,
  borderBottomColor: COLORS.border,
},
notifPanelTitle: {
  color: COLORS.text,
  fontSize: 18,
  fontWeight: '800',
},
notifEmpty: {
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  paddingVertical: 50,
},
notifEmptyText: {
  color: COLORS.textMuted,
  fontSize: 15,
},
notifItem: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 12,
  paddingHorizontal: 22,
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: COLORS.border,
},
notifItemUnread: {
  backgroundColor: '#0d1e2e',
},
notifIconCircle: {
  width: 38,
  height: 38,
  borderRadius: 19,
  alignItems: 'center',
  justifyContent: 'center',
},
notifTitulo: {
  color: COLORS.text,
  fontSize: 14,
  fontWeight: '700',
  marginBottom: 3,
},
notifMensaje: {
  color: COLORS.textMuted,
  fontSize: 13,
  lineHeight: 18,
  marginBottom: 4,
},
notifFecha: {
  color: COLORS.textMuted,
  fontSize: 11,
},
notifUnreadDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: COLORS.green,
  marginTop: 6,
},
notifClearAllText: {
  color: COLORS.error,
  fontSize: 13,
  fontWeight: '600',
},
notifDeleteBtn: {
  paddingTop: 2,
  alignSelf: 'flex-start',
},
});