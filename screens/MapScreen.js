import React, { useEffect, useState } from "react";
import { View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

export default function MapScreen() {
  const [gyms, setGyms] = useState([]);

  useEffect(() => {
    const fetchGyms = async () => {
      const snapshot = await getDocs(collection(db, "gimnasios"));

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("GYMS:", data);

      setGyms(data);
    };

    fetchGyms();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
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
              coordinate={{
                latitude: lat,
                longitude: lng,
              }}
              title={gym.nombreGimnasio}
              description={gym.direccion}
            />
          );
        })}
      </MapView>
    </View>
  );
}