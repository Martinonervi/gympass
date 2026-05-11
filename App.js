import { NavigationContainer } from "@react-navigation/native";
import * as React from "react";
import { MD3DarkTheme, PaperProvider } from "react-native-paper";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { navigationRef } from "./navigationRef";
import BottomTabs from "./screens/BottomTabs";

import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import GymOwnerHomeScreen from "./screens/GymOwnerHomeScreen";
import EmployerHomeScreen from "./screens/EmployerHomeScreen";

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

          <Stack.Screen name="GymOwnerHome" component={GymOwnerHomeScreen} />
          <Stack.Screen name="EmployerHome" component={EmployerHomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default App;