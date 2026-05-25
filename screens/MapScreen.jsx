import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from "react-native-maps";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import * as Location from "expo-location";

const LOCATION_TIMEOUT_MS = 6000;
const DEFAULT_REGION = { latitude: -34.6037, longitude: -58.3816, latitudeDelta: 0.1, longitudeDelta: 0.1 };

export default function MapScreen({ route, navigation }) {
  const [gyms, setGyms] = useState([]);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [initialRegion, setInitialRegion] = useState(null);
  const mapRef = useRef(null);
  const insets = useSafeAreaInsets();

  const focusLat = route?.params?.latitude ? Number(route.params.latitude) : null;
  const focusLng = route?.params?.longitude ? Number(route.params.longitude) : null;
  const focusName = route?.params?.gymName || null;

  useEffect(() => {
    const fetchGyms = async () => {
      const snapshot = await getDocs(collection(db, "gimnasios"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setGyms(data);
    };
    fetchGyms();
  }, []);

  useEffect(() => {
    // Si viene con coordenadas de un gimnasio específico, usarlas directamente
    if (focusLat !== null && focusLng !== null && !isNaN(focusLat) && !isNaN(focusLng)) {
      setInitialRegion({ latitude: focusLat, longitude: focusLng, latitudeDelta: 0.008, longitudeDelta: 0.008 });
      if (focusName) setQuery(focusName);
      return;
    }

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setInitialRegion(DEFAULT_REGION);
      }
    }, LOCATION_TIMEOUT_MS);

    async function fetchLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!resolved) { resolved = true; clearTimeout(timeout); setInitialRegion(DEFAULT_REGION); }
          return;
        }

        // Intentar ubicación cacheada primero (respuesta instantánea)
        const cached = await Location.getLastKnownPositionAsync({});
        if (cached && !resolved) {
          const coords = { latitude: cached.coords.latitude, longitude: cached.coords.longitude };
          setUserLocation(coords);
          resolved = true;
          clearTimeout(timeout);
          setInitialRegion({ ...coords, latitudeDelta: 0.08, longitudeDelta: 0.08 });
        }

        // Actualizar con posición fresca (sin bloquear si ya resolvimos con caché)
        const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const coords = { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
        setUserLocation(coords);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          setInitialRegion({ ...coords, latitudeDelta: 0.08, longitudeDelta: 0.08 });
        }
      } catch (e) {
        console.error("Error getting location:", e);
        if (!resolved) { resolved = true; clearTimeout(timeout); setInitialRegion(DEFAULT_REGION); }
      }
    }

    fetchLocation();
    return () => clearTimeout(timeout);
  }, []);

  const goToUserLocation = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
    }
  };

  const suggestions = query.length > 0
    ? gyms.filter((g) => g.nombreGimnasio?.toLowerCase().includes(query.toLowerCase()))
    : [];

  const handleSelectGym = (gym) => {
    const lat = Number(gym.latitude);
    const lng = Number(gym.longitude);
    setQuery(gym.nombreGimnasio);
    setShowSuggestions(false);
    if (!isNaN(lat) && !isNaN(lng)) {
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
    }
  };

  if (!initialRegion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        pointerEvents="box-none"
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {gyms.map((gym) => {
          const lat = Number(gym.latitude);
          const lng = Number(gym.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;
          return (
            <Marker
              key={gym.id}
              coordinate={{ latitude: lat, longitude: lng }}
              tracksViewChanges={false}
            >
              <View style={styles.markerContainer}>
                <View style={styles.markerBubble}>
                  <MaterialCommunityIcons name="dumbbell" size={16} color="#22c55e" />
                </View>
                <View style={styles.markerTip} />
              </View>
              <Callout tooltip onPress={() => navigation.navigate("GymDetail", { gymId: gym.id })}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{gym.nombreGimnasio}</Text>
                  {gym.descripcion ? <Text style={styles.calloutDesc}>{gym.descripcion}</Text> : null}
                  <Text style={styles.calloutAddress}>{gym.direccion}</Text>
                  <Text style={styles.calloutLink}>Ver detalles →</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Botón volver */}
      {navigation.canGoBack() && (
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 12 }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Barra de búsqueda flotante */}
      <View style={[styles.searchContainer, { top: insets.top + 12 }]}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar gimnasio..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={(text) => { setQuery(text); setShowSuggestions(true); }}
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
              <TouchableOpacity style={styles.suggestionItem} onPress={() => handleSelectGym(item)}>
                <MaterialCommunityIcons name="dumbbell" size={16} color="#22c55e" style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.suggestionName}>{item.nombreGimnasio}</Text>
                  {item.direccion ? <Text style={styles.suggestionAddress}>{item.direccion}</Text> : null}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Botón mi ubicación */}
      {userLocation && (
        <TouchableOpacity
          style={[styles.myLocationButton, { bottom: insets.bottom + 24 }]}
          onPress={goToUserLocation}
        >
          <Ionicons name="navigate" size={20} color="#22c55e" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f1520",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 15,
  },
  backButton: {
    position: "absolute",
    left: 16,
    zIndex: 20,
    backgroundColor: "#152030",
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: "#243244",
  },
  searchContainer: {
    position: "absolute",
    left: 78,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#152030",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#243244",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  searchInput: { flex: 1, color: "#ffffff", fontSize: 15, marginLeft: 8 },
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
  suggestionName: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  suggestionAddress: { color: "#64748b", fontSize: 12, marginTop: 2 },
  markerContainer: {
    alignItems: "center",
  },
  markerBubble: {
    backgroundColor: "#152030",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1.5,
    borderColor: "#22c55e",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  markerTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#22c55e",
    marginTop: -1,
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
  calloutTitle: { color: "#ffffff", fontWeight: "bold", fontSize: 15, marginBottom: 4 },
  calloutDesc: { color: "#94a3b8", fontSize: 13, marginBottom: 4 },
  calloutAddress: { color: "#64748b", fontSize: 12, marginBottom: 8 },
  calloutLink: { color: "#22c55e", fontSize: 13, fontWeight: "600", textAlign: "right" },
  myLocationButton: {
    position: "absolute",
    right: 16,
    backgroundColor: "#152030",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#243244",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
