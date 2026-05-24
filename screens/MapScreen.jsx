import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

export default function MapScreen({ navigation }) {
  const [gyms, setGyms] = useState([]);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const mapRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchGyms = async () => {
      const snapshot = await getDocs(collection(db, "gimnasios"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGyms(data);
    };
    fetchGyms();
  }, []);

  const suggestions = query.length > 0
    ? gyms.filter((g) =>
        g.nombreGimnasio?.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const handleSelectGym = (gym) => {
    const lat = Number(gym.latitude);
    const lng = Number(gym.longitude);
    setQuery(gym.nombreGimnasio);
    setShowSuggestions(false);
    if (!isNaN(lat) && !isNaN(lng)) {
      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 600);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        pointerEvents="box-none"
        initialRegion={{
          latitude: -34.6037,
          longitude: -58.3816,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {gyms.map((gym) => {
          const lat = Number(gym.latitude);
          const lng = Number(gym.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;
          return (
            <Marker
              key={gym.id}
              coordinate={{ latitude: lat, longitude: lng }}
            >
              <Callout
                tooltip
                onPress={() => navigation.navigate("GymDetail", { gymId: gym.id })}
              >
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{gym.nombreGimnasio}</Text>
                  {gym.descripcion ? (
                    <Text style={styles.calloutDesc}>{gym.descripcion}</Text>
                  ) : null}
                  <Text style={styles.calloutAddress}>{gym.direccion}</Text>
                  <Text style={styles.calloutLink}>Ver detalles →</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Barra de búsqueda flotante */}
      <View style={[styles.searchContainer, { top: insets.top + 12 }]}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar gimnasio..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); setShowSuggestions(false); }}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {showSuggestions && suggestions.length > 0 && (
          <FlatList
            style={styles.suggestionsList}
            data={suggestions}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelectGym(item)}
              >
                <MaterialCommunityIcons name="dumbbell" size={16} color="#22c55e" style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.suggestionName}>{item.nombreGimnasio}</Text>
                  {item.direccion ? (
                    <Text style={styles.suggestionAddress}>{item.direccion}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#152030",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#243244",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    marginLeft: 8,
  },
  suggestionsList: {
    backgroundColor: "#152030",
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#243244",
    maxHeight: 220,
    elevation: 5,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#243244",
  },
  suggestionName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionAddress: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  callout: {
    backgroundColor: "#152030",
    borderRadius: 10,
    padding: 12,
    minWidth: 200,
    maxWidth: 260,
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  calloutTitle: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
    marginBottom: 4,
  },
  calloutDesc: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 4,
  },
  calloutAddress: {
    color: "#64748b",
    fontSize: 12,
    marginBottom: 8,
  },
  calloutLink: {
    color: "#22c55e",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
});
