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
import ManageGymDetailsScreen from "./screens/ManageGymDetailsScreen";
import EmployerHomeScreen from "./screens/EmployerHomeScreen";
import ChangeLoginDataScreen from "./screens/ChangeLoginDataScreen";
import SplashScreen from "./screens/SplashScreen";

import { auth, db } from "./firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const Stack = createNativeStackNavigator();

function getInitialRoute(role) {
  if (role === "gimnasio") return "GymOwnerHome";
  if (role === "empleador") return "EmployerHome";
  return "Tabs";
}

function App() {
  const currentTheme = MD3DarkTheme;
  const [isSignedIn, setIsSignedIn] = React.useState(false);
  const [userRole, setUserRole] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, 2000));
    let splashDone = false;

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "usuarios", user.uid));
          const rol = userDoc.exists() ? userDoc.data().rol : "usuario";
          setUserRole(rol);
        } catch (e) {
          console.error("Error fetching role:", e);
          setUserRole("usuario");
        }
        setIsSignedIn(true);
      } else {
        setIsSignedIn(false);
        setUserRole(null);
      }

      if (!splashDone) {
        splashDone = true;
        minDelay.then(() => setIsLoading(false));
      }
    });

    return unsubscribe;
  }, []);

  if (isLoading) {
    return (
      <PaperProvider theme={currentTheme}>
        <SplashScreen />
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={currentTheme}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => console.log("Nav ready")}
      >
        {isSignedIn ? (
          <Stack.Navigator
            screenOptions={{ headerShown: false }}
            initialRouteName={getInitialRoute(userRole)}
          >
            <Stack.Screen name="Tabs">
              {() => <BottomTabs theme={currentTheme} setIsSignedIn={setIsSignedIn} />}
            </Stack.Screen>
            <Stack.Screen name="GymOwnerHome" component={GymOwnerHomeScreen} />
            <Stack.Screen name="ManageGymDetails" component={ManageGymDetailsScreen} />
            <Stack.Screen name="EmployerHome" component={EmployerHomeScreen} />
            <Stack.Screen name="ChangeLoginData" component={ChangeLoginDataScreen} />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen {...props} setIsSignedIn={setIsSignedIn} />
              )}
            </Stack.Screen>
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </PaperProvider>
  );
}

export default App;