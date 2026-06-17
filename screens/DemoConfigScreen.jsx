import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ejecutarSeeding } from '../utils/seedDatabase';

const COLORS = {
    bg: "#0f1520",
    card: "#152030",
    green: "#22c55e",
    orange: "#f59e0b",
    text: "#ffffff",
    textSecondary: "#9ca3af"
};

export default function DemoConfigScreen() {
    const [loading, setLoading] = useState(false);

    const handleCargarDatos = async () => {
        setLoading(true);
        const success = await ejecutarSeeding();
        setLoading(false);

        if (success) {
            Alert.alert("Éxito", "Base de datos poblada. Entorno listo para la demo.");
        } else {
            Alert.alert("Error", "Hubo un problema al cargar los datos de demo.");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Panel de Desarrollador</Text>
            
            <View style={styles.card}>
                <Text style={styles.description}>
                    Esta acción poblará la base de datos de Firebase con información predeterminada (gimnasios, clases, reseñas y empleadores) para preparar el entorno de demostración de GymPass.
                </Text>

                <TouchableOpacity 
                    style={styles.button} 
                    onPress={handleCargarDatos}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text style={styles.buttonText}>Cargar Datos de Demo</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
        padding: 20,
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 30,
        textAlign: 'center',
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    description: {
        color: COLORS.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },
    button: {
        backgroundColor: COLORS.orange,
        width: '100%',
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    }
});
