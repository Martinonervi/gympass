import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Header estándar de la app: flecha de volver (blanca) + título a la derecha.
 * Mismo estilo que la pantalla de Reseñas. Opcionalmente acepta un elemento a
 * la derecha (ej. un botón o badge).
 */
export default function ScreenHeader({ title, onBack, right = null }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#ffffff" />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "bold",
    flex: 1,
  },
  right: {
    marginLeft: 12,
  },
});
