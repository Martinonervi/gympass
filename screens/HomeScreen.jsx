import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
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
            limit(5)
          ));
          console.log('Reservas encontradas:', reservasSnap.size);
          if (active) {
            const lista = reservasSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
            setReservas(lista);
          }
        } catch (e) {
          console.log('HomeScreen: error cargando reservas:', e?.code, e?.message);
        } finally {
          if (active) setLoadingReservas(false);
        }
      };

      fetchUserData();
      return () => { active = false; };
    }, [])
  );

  const planData = planId ? PLANES[planId] : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>Buenos días</Text>
            <Text style={styles.greetingName}>
              Hola{nombreUsuario ? `, ${nombreUsuario}` : ''}!
            </Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={18} color={COLORS.textSecondary} />
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
              <View key={res.id} style={styles.reservationCard}>
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
                    {esClase ? res.nombreClase : res.nombreGimnasio}
                  </Text>
                  {esClase && res.nombreGimnasio ? (
                    <Text style={styles.resDetail}>{res.nombreGimnasio}</Text>
                  ) : null}
                  {esClase && res.diaHora ? (
                    <Text style={styles.resDetail}>{res.diaHora}</Text>
                  ) : null}
                  {fecha ? (
                    <View style={styles.resLoc}>
                      <Ionicons name="calendar-outline" size={10} color={COLORS.textMuted} />
                      <Text style={styles.resLocText}>Reservado el {fecha}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {/* Feedback ocupación */}
        <View style={styles.feedbackCard}>
          <View style={styles.fbHeader}>
            <View style={styles.fbIconWrap}>
              <Ionicons name="location" size={16} color="#f59e0b" />
            </View>
            <View>
              <Text style={styles.fbTitle}>Visita reciente: {mockData.recentVisit.gym}</Text>
              <Text style={styles.fbTime}>{mockData.recentVisit.timeAgo}</Text>
            </View>
          </View>
          <Text style={styles.fbQuestion}>¿Qué tan lleno estaba el gimnasio hoy?</Text>
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
        </View>

        {/* Atajos */}
        <Text style={styles.atajoTitle}>Atajos de Exploración</Text>
        <View style={styles.atajoGrid}>
          <TouchableOpacity
            style={styles.atajoCard}
            onPress={() => navigation.navigate('MapTab')}
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
});