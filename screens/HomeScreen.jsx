import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

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

const mockData = {
  user: { name: 'G9', notifications: 2 },
  plan: {
    name: 'Plan Silver',
    status: 'Activo',
    benefit: 'Beneficio corporativo activo',
  },
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
  { label: 'Vacío',    emoji: '😄', color: '#14532d' },
  { label: 'Tranquilo', emoji: '🙂', color: '#14532d' },
  { label: 'Moderado', emoji: '😐', color: '#1e3a1a' },
  { label: 'Lleno',    emoji: '😟', color: '#3a2a10' },
  { label: 'Muy lleno', emoji: '😰', color: '#3a1010' },
];

export default function HomeScreen() {
  const [selectedOccupancy, setSelectedOccupancy] = useState(null);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>Buenos días</Text>
            <Text style={styles.greetingName}>Hola, {mockData.user.name}!</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={18} color={COLORS.textSecondary} />
            {mockData.user.notifications > 0 && <View style={styles.notifDot} />}
          </TouchableOpacity>
        </View>

        <View style={styles.planCard}>
          <View style={styles.planBadge}>
            <MaterialCommunityIcons name="star-four-points" size={10} color="#d1fae5" />
            <Text style={styles.planBadgeText}>Plan Activo</Text>
          </View>
          <View style={styles.planIconTop}>
            <MaterialCommunityIcons name="dumbbell" size={20} color="rgba(255,255,255,0.7)" />
          </View>
          <Text style={styles.planName}>{mockData.plan.name}</Text>
          <View style={styles.planBenefit}>
            <MaterialCommunityIcons name="office-building" size={12} color="#86efac" />
            <Text style={styles.planBenefitText}>{mockData.plan.benefit}</Text>
          </View>
          <TouchableOpacity style={styles.planBtn}>
            <Text style={styles.planBtnText}>Ver detalles del plan</Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Próximas Reservas</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        {mockData.reservations.map((res) => (
          <View key={res.id} style={styles.reservationCard}>
            <View style={styles.resIcon}>
              <MaterialCommunityIcons name="dumbbell" size={22} color={COLORS.green} />
            </View>
            <View style={styles.resBody}>
              <View style={styles.resTagWrapper}>
                <Text style={styles.resTag}>{res.tag}</Text>
              </View>
              <Text style={styles.resName}>{res.name}</Text>
              <Text style={styles.resDetail}>{res.time} en {res.gym}</Text>
              <View style={styles.resLoc}>
                <Ionicons name="location-outline" size={10} color={COLORS.textMuted} />
                <Text style={styles.resLocText}>{res.address}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.verBtn}>
              <MaterialCommunityIcons name="calendar-outline" size={13} color={COLORS.textSecondary} />
              <Text style={styles.verBtnText}>Ver</Text>
            </TouchableOpacity>
          </View>
        ))}

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

        <Text style={styles.atajoTitle}>Atajos de Exploración</Text>
        <View style={styles.atajoGrid}>
          <TouchableOpacity style={styles.atajoCard}>
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
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, marginTop: 20 },
  greetingSub: { fontSize: 12, color: COLORS.textMuted, marginBottom: 2 },
  greetingName: { fontSize: 26, fontWeight: '700', color: COLORS.text, letterSpacing: -0.5 },
  notifBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a2535', borderWidth: 1, borderColor: '#2a3a4e', alignItems: 'center', justifyContent: 'center' },
  notifDot: { width: 7, height: 7, backgroundColor: COLORS.green, borderRadius: 4, position: 'absolute', top: 6, right: 7, borderWidth: 1.5, borderColor: COLORS.bg },

  planCard: { backgroundColor: COLORS.greenDark, borderRadius: 18, padding: 18, marginBottom: 24 },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start', marginBottom: 6 },
  planBadgeText: { fontSize: 11, color: '#d1fae5' },
  planIconTop: { position: 'absolute', top: 14, right: 16, width: 38, height: 38, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  planBenefit: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  planBenefitText: { fontSize: 12, color: '#bbf7d0' },
  planBtn: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  planBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  seeAll: { fontSize: 12, color: COLORS.green, fontWeight: '500' },

  reservationCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border },
  resIcon: { width: 44, height: 44, backgroundColor: '#1e3a28', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resBody: { flex: 1 },
  resTagWrapper: { marginBottom: 3 },
  resTag: { backgroundColor: COLORS.greenDark, color: '#fff', fontSize: 10, fontWeight: '600', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, alignSelf: 'flex-start' },
  resName: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 1 },
  resDetail: { fontSize: 11, color: COLORS.textMuted },
  resLoc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  resLocText: { fontSize: 11, color: COLORS.textMuted },
  verBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1e2e40', borderWidth: 1, borderColor: '#2a3d52', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  verBtnText: { fontSize: 12, color: COLORS.textSecondary },

  feedbackCard: { backgroundColor: COLORS.cardDark, borderRadius: 14, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: COLORS.border },
  fbHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  fbIconWrap: { width: 34, height: 34, backgroundColor: 'rgba(194,120,0,0.12)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fbTitle: { fontSize: 13, fontWeight: '600', color: '#e2e8f0' },
  fbTime: { fontSize: 11, color: '#4a6070' },
  fbQuestion: { fontSize: 13, color: '#8fa3b0', marginVertical: 10 },
  fbOptions: { flexDirection: 'row', justifyContent: 'space-between' },
  fbOption: { alignItems: 'center', gap: 4, flex: 1 },
  fbEmoji: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  fbEmojiSelected: { borderWidth: 2, borderColor: COLORS.green },
  fbLabel: { fontSize: 10, color: '#5d7a8a', textAlign: 'center' },

  atajoTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  atajoGrid: { flexDirection: 'row', gap: 10 },
  atajoCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  atajoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  atajoLabel: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', fontWeight: '500' },
});