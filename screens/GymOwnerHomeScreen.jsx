import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

export default function GymOwnerHomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Panel del gimnasio</Text>
      <Text style={styles.subtitle}>
        Acá va la vista para dueños de gimnasio.
      </Text>

      <TouchableOpacity
        style={[styles.button, { marginBottom: 12 }]}
        onPress={() => navigation.navigate("Tabs", { screen: "ProfileTab" })}
      >
        <Text style={styles.buttonText}>Ir a Mi Perfil (Testing)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { marginBottom: 12 }]}
        onPress={() => navigation.navigate("ManageGymDetails")}
      >
        <Text style={styles.buttonText}>Detalles y fotos del gimnasio</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.replace("Login")}
      >
        <Text style={styles.buttonText}>Volver al login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1520",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  title: {
    color: "#22c55e",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
});