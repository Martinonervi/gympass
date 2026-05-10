/*
import { NavigationContainer } from '@react-navigation/native';
import * as React from 'react';
import { useEffect } from 'react';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './screens/HomeScreen';
import { navigationRef } from './navigationRef';
import BottomTabs from './screens/BottomTabs';

const Stack = createNativeStackNavigator();

function App() {
  const currentTheme = MD3DarkTheme;

  return (
    <PaperProvider theme={currentTheme}>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => console.log("Nav ready")}
        >
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Tabs" options={{ headerShown: false }}>
              {() => <BottomTabs theme={currentTheme} />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
    </PaperProvider>
  );
}

export default App;

*/
import { NavigationContainer } from "@react-navigation/native";
import * as React from "react";
import { MD3DarkTheme, PaperProvider } from "react-native-paper";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { navigationRef } from "./navigationRef";
import BottomTabs from "./screens/BottomTabs";

import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";

const Stack = createNativeStackNavigator();

function App() {
  const currentTheme = MD3DarkTheme;

  return (
    <PaperProvider theme={currentTheme}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => console.log("Nav ready")}
      >
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

          <Stack.Screen name="Tabs">
            {() => <BottomTabs theme={currentTheme} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default App;