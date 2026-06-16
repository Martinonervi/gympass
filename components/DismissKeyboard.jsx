import React from "react";
import { Keyboard, TouchableWithoutFeedback } from "react-native";

/**
 * Envuelve su contenido para que, al tocar cualquier zona vacía (fuera de un
 * campo de texto), se cierre el teclado. Útil sobre todo con teclados numéricos
 * que no tienen tecla "Listo" para ocultarse.
 *
 * Uso: envolver el contenido raíz de una pantalla basada en View (no ScrollView).
 * Para pantallas con ScrollView usar keyboardShouldPersistTaps="handled".
 */
export default function DismissKeyboard({ children, style }) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {children}
    </TouchableWithoutFeedback>
  );
}
