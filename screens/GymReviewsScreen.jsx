import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  border: "#243244",
  text: "#ffffff",
  textMuted: "#94a3b8",
  error: "#ef4444",
};

function formatFecha(ts) {
  if (!ts) return "";
  const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const StarRating = ({ rating }) => {
  return (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <MaterialCommunityIcons
          key={star}
          name={star <= rating ? "star" : "star-outline"}
          size={16}
          color={star <= rating ? "#f59e0b" : COLORS.textMuted}
        />
      ))}
    </View>
  );
};

export default function GymReviewsScreen({ navigation }) {
  const [reviews, setReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);

  // Filters
  const [dateFilter, setDateFilter] = useState("Todos"); // "Todos" | "Ultimos 30"
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [planFilter, setPlanFilter] = useState("Todos"); // "Todos" | "Classic" | "Platinum" | "Black"

  // Responder Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [reviews, dateFilter, unansweredOnly, planFilter]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const querySnapshot = await getDocs(
        collection(db, "gimnasios", user.uid, "resenas")
      );

      const fetchedReviews = [];
      let totalStars = 0;
      let validRatings = 0;

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const r = { id: docSnap.id, ...data };
        fetchedReviews.push(r);

        if (typeof r.rating === "number") {
          totalStars += r.rating;
          validRatings++;
        }
      });

      // Sort by date descending
      fetchedReviews.sort((a, b) => {
        const aTs = a.fecha?.seconds || 0;
        const bTs = b.fecha?.seconds || 0;
        return bTs - aTs;
      });

      setReviews(fetchedReviews);

      if (validRatings > 0) {
        setAverageRating(totalStars / validRatings);
      } else {
        setAverageRating(0);
      }
    } catch (error) {
      console.log("Error fetching reviews:", error);
      Alert.alert("Error", "No se pudieron cargar las reseñas.");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let current = [...reviews];

    // Filter by Date
    if (dateFilter === "Ultimos 30") {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      current = current.filter((r) => {
        if (!r.fecha) return false;
        const date = r.fecha.seconds ? new Date(r.fecha.seconds * 1000) : new Date(r.fecha);
        return date >= thirtyDaysAgo;
      });
    }

    // Filter Unanswered
    if (unansweredOnly) {
      current = current.filter((r) => !r.respuestaGym || r.respuestaGym.trim() === "");
    }

    // Filter by Plan
    if (planFilter !== "Todos") {
      current = current.filter((r) => (r.plan || "Classic") === planFilter);
    }

    setFilteredReviews(current);
  };

  const handleOpenResponder = (review) => {
    setSelectedReview(review);
    setResponseText(review.respuestaGym || "");
    setModalVisible(true);
  };

  const handleSubmitResponse = async () => {
    if (!selectedReview) return;

    if (!responseText.trim()) {
      Alert.alert("Error", "La respuesta no puede estar vacía.");
      return;
    }

    setSubmittingResponse(true);
    try {
      const user = auth.currentUser;
      const reviewRef = doc(db, "gimnasios", user.uid, "resenas", selectedReview.id);
      
      await updateDoc(reviewRef, {
        respuestaGym: responseText.trim(),
      });

      // Update local state
      setReviews((prev) =>
        prev.map((r) =>
          r.id === selectedReview.id ? { ...r, respuestaGym: responseText.trim() } : r
        )
      );

      setModalVisible(false);
      setSelectedReview(null);
      setResponseText("");
    } catch (error) {
      console.log("Error saving response:", error);
      Alert.alert("Error", "No se pudo guardar la respuesta.");
    } finally {
      setSubmittingResponse(false);
    }
  };

  const renderReview = ({ item }) => {
    const hasResponse = !!item.respuestaGym && item.respuestaGym.trim().length > 0;
    const planLabelColor = 
      item.plan === "Black" ? "#000" : 
      item.plan === "Platinum" ? "#94a3b8" : 
      COLORS.green; // Default Classic

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.userName}>{item.emailUsuario || item.nombreUsuario || "Usuario anónimo"}</Text>
          <Text style={styles.dateText}>{formatFecha(item.fecha)}</Text>
        </View>

        <View style={styles.cardInfoRow}>
          <StarRating rating={item.rating || 0} />
          {item.plan && (
            <View style={[styles.planBadge, { backgroundColor: planLabelColor }]}>
              <Text style={styles.planBadgeText}>{item.plan}</Text>
            </View>
          )}
        </View>

        <Text style={styles.commentText}>{item.comentario || "Sin comentario."}</Text>

        {hasResponse ? (
          <View style={styles.responseContainer}>
            <Text style={styles.responseLabel}>Tu respuesta:</Text>
            <Text style={styles.responseText}>{item.respuestaGym}</Text>
            <TouchableOpacity onPress={() => handleOpenResponder(item)}>
              <Text style={styles.editResponseText}>Editar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.responderButton} 
            onPress={() => handleOpenResponder(item)}
          >
            <MaterialCommunityIcons name="reply" size={16} color={COLORS.bg} />
            <Text style={styles.responderButtonText}>Responder</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Reseñas de alumnos</Text>
      </View>

      <View style={styles.statsContainer}>
        <MaterialCommunityIcons name="star" size={32} color="#f59e0b" />
        <View style={styles.statsTextContainer}>
          <Text style={styles.statsAverage}>{averageRating.toFixed(1)} / 5</Text>
          <Text style={styles.statsTotal}>{reviews.length} reseñas totales</Text>
        </View>
      </View>

      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {/* Date Filter */}
          <TouchableOpacity
            style={[styles.filterChip, dateFilter === "Ultimos 30" && styles.filterChipActive]}
            onPress={() => setDateFilter(prev => prev === "Todos" ? "Ultimos 30" : "Todos")}
          >
            <MaterialCommunityIcons 
              name="calendar" 
              size={16} 
              color={dateFilter === "Ultimos 30" ? COLORS.bg : COLORS.textMuted} 
            />
            <Text style={[styles.filterChipText, dateFilter === "Ultimos 30" && styles.filterChipTextActive]}>
              Últimos 30 días
            </Text>
          </TouchableOpacity>

          {/* Plan Filter */}
          <TouchableOpacity
            style={[styles.filterChip, planFilter !== "Todos" && styles.filterChipActive]}
            onPress={() => {
              const nextPlan = 
                planFilter === "Todos" ? "Classic" :
                planFilter === "Classic" ? "Platinum" :
                planFilter === "Platinum" ? "Black" : "Todos";
              setPlanFilter(nextPlan);
            }}
          >
            <MaterialCommunityIcons 
              name="card-account-details-star" 
              size={16} 
              color={planFilter !== "Todos" ? COLORS.bg : COLORS.textMuted} 
            />
            <Text style={[styles.filterChipText, planFilter !== "Todos" && styles.filterChipTextActive]}>
              Plan: {planFilter}
            </Text>
          </TouchableOpacity>

          {/* Unanswered Switch */}
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Sin responder</Text>
            <Switch
              value={unansweredOnly}
              onValueChange={setUnansweredOnly}
              trackColor={{ false: COLORS.border, true: COLORS.green }}
              thumbColor={COLORS.text}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.green} />
        </View>
      ) : filteredReviews.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="comment-off-outline" size={48} color={COLORS.border} />
          <Text style={styles.emptyText}>No se encontraron reseñas</Text>
          <Text style={styles.emptySubtext}>Prueba ajustando los filtros</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item) => item.id}
          renderItem={renderReview}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Responder Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Responder Reseña</Text>
            {selectedReview && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                De {selectedReview.emailUsuario || selectedReview.nombreUsuario || "Usuario"}: "{selectedReview.comentario}"
              </Text>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Escribe tu respuesta aquí..."
              placeholderTextColor={COLORS.textMuted}
              value={responseText}
              onChangeText={setResponseText}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setResponseText("");
                }}
                disabled={submittingResponse}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSubmitResponse}
                disabled={submittingResponse}
              >
                {submittingResponse ? (
                  <ActivityIndicator size="small" color={COLORS.bg} />
                ) : (
                  <Text style={styles.modalSaveText}>Guardar Respuesta</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "bold",
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    marginHorizontal: 20,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  statsTextContainer: {
    marginLeft: 15,
  },
  statsAverage: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "900",
  },
  statsTotal: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  filtersWrapper: {
    height: 50,
    marginBottom: 10,
  },
  filtersScroll: {
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 12,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  filterChipText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: COLORS.bg,
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switchLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginRight: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  userName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  dateText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  cardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: "row",
    marginRight: 12,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  planBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  commentText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  responderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.text,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  responderButtonText: {
    color: COLORS.bg,
    fontSize: 14,
    fontWeight: "bold",
  },
  responseContainer: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.2)",
  },
  responseLabel: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  responseText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  editResponseText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
    marginTop: 8,
    alignSelf: "flex-end",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    width: "100%",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 20,
    fontStyle: "italic",
  },
  modalInput: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderRadius: 12,
    padding: 16,
    height: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  modalCancelText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "bold",
  },
  modalSaveButton: {
    backgroundColor: COLORS.green,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 140,
    alignItems: "center",
  },
  modalSaveText: {
    color: COLORS.bg,
    fontSize: 14,
    fontWeight: "bold",
  },
});
