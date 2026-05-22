import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

const COLORS = {
  bg: "#0f1520",
  card: "#152030",
  green: "#22c55e",
  text: "#ffffff",
  textMuted: "#94a3b8",
  border: "#243244",
};

export default function ExploreScreen({ navigation }) {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGyms() {
      try {
        const gymsCollection = collection(db, "gimnasios");
        const querySnapshot = await getDocs(gymsCollection);
        const loadedGyms = [];
        
        querySnapshot.forEach((doc) => {
          loadedGyms.push({ id: doc.id, ...doc.data() });
        });
        
        setGyms(loadedGyms);
      } catch (error) {
        console.error("Error fetching gyms:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchGyms();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("GymDetail", { gymId: item.id })}
    >
      <Text style={styles.cardTitle}>
        {item.nombre || item.nombreGimnasio || "Gimnasio sin nombre"}
      </Text>
      <Text style={styles.cardAddress}>
        {item.direccion || "Dirección no especificada"}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ActivityIndicator size="large" color={COLORS.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Explorar Gimnasios</Text>
      </View>
      
      <FlatList
        data={gyms}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No se encontraron gimnasios.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 22,
    paddingBottom: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "800",
  },
  listContainer: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  cardTitle: {
    color: COLORS.green,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  cardAddress: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },
});