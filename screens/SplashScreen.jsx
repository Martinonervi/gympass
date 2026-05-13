import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  bg: "#0f1520",
  green: "#22c55e",
  greenDark: "#16a34a",
  textMuted: "#94a3b8",
};

export default function SplashScreen() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(24)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const dotScale1 = useRef(new Animated.Value(0.4)).current;
  const dotScale2 = useRef(new Animated.Value(0.4)).current;
  const dotScale3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Logo entra primero
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoTranslateY, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Subtitle aparece después del logo
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });

    // Dots pulsan en loop
    const pulseDot = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.4,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();

    pulseDot(dotScale1, 300);
    pulseDot(dotScale2, 500);
    pulseDot(dotScale3, 700);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.container}>
        {/* Logo */}
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ translateY: logoTranslateY }],
            alignItems: "center",
          }}
        >
          <Text style={styles.logo}>GymPass</Text>
          <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
            Entrená donde quieras
          </Animated.Text>
        </Animated.View>

        {/* Dots loader */}
        <View style={styles.dots}>
          {[dotScale1, dotScale2, dotScale3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity: dot }]}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 48,
  },
  logo: {
    color: COLORS.green,
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginTop: 8,
    letterSpacing: 0.2,
  },
  dots: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },
});