import { NavigationContainer } from "@react-navigation/native";
import * as React from "react";
import { MD3DarkTheme, PaperProvider } from "react-native-paper";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { navigationRef } from "./navigationRef";
import BottomTabs from "./screens/BottomTabs";
import GymOwnerTabs from "./screens/GymOwnerTabs";
import EmployerTabs from "./screens/EmployerTabs";

import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ManageGymDetailsScreen from "./screens/ManageGymDetailsScreen";
import ChangeLoginDataScreen from "./screens/ChangeLoginDataScreen";
import SplashScreen from "./screens/SplashScreen";
import EditGymInfoScreen from "./screens/EditGymInfoScreen";
import EditEmployerInfoScreen from "./screens/EditEmployerInfoScreen";
import EditUserInfoScreen from "./screens/EditUserInfoScreen";
import ManageClassesScreen from "./screens/ManageClassesScreen";
import AddClassScreen from "./screens/AddClassScreen";
import GymDetailScreen from "./screens/GymDetailScreen";
import GymReservationsScreen from "./screens/GymReservationsScreen";
import ClassCalendarScreen from "./screens/ClassCalendarScreen";
import QRScannerScreen from "./screens/QRScannerScreen";
import CodeValidatorScreen from "./screens/CodeValidatorScreen";
import GymReportsScreen from "./screens/GymReportsScreen";
import GymReviewsScreen from "./screens/GymReviewsScreen";
import MapScreen from "./screens/MapScreen";
import EmployerPlanConfigScreen from "./screens/EmployerPlanConfigScreen";
import EmployerManageEmployeesScreen from "./screens/EmployerManageEmployeesScreen";
import LinkCorporateAccountScreen from "./screens/LinkCorporateAccountScreen";
import { auth, db } from "./firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

import GymStatsScreen from "./screens/GymStatsScreen";

const Stack = createNativeStackNavigator();

function getInitialRoute(role) {
  if (role === "gimnasio") return "GymOwnerTabs";
  if (role === "empleador") return "EmployerTabs";
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
        // El token de auth puede tardar un instante en propagarse a Firestore
        // (típico en cuentas recién creadas), lo que produce un permission-denied
        // transitorio. Reintentamos un par de veces antes de rendirnos.
        const fetchRoleWithRetry = async (intentos = 3, delay = 600) => {
          for (let i = 0; i < intentos; i++) {
            try {
              const userDoc = await getDoc(doc(db, "usuarios", user.uid));
              return userDoc.exists() ? userDoc.data().rol : "usuario";
            } catch (e) {
              const esPermiso =
                e?.code === "permission-denied" ||
                /insufficient permissions/i.test(e?.message || "");
              if (esPermiso && i < intentos - 1) {
                await new Promise((r) => setTimeout(r, delay));
                continue;
              }
              console.error("Error fetching role:", e);
              return "usuario";
            }
          }
          return "usuario";
        };

        const rol = await fetchRoleWithRetry();
        setUserRole(rol);
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
            key={userRole}
            screenOptions={{ headerShown: false }}
            initialRouteName={getInitialRoute(userRole)}
          >
            <Stack.Screen name="Tabs">
              {() => <BottomTabs theme={currentTheme} setIsSignedIn={setIsSignedIn} />}
            </Stack.Screen>
            <Stack.Screen name="GymOwnerTabs">
              {() => <GymOwnerTabs theme={currentTheme} setIsSignedIn={setIsSignedIn} />}
            </Stack.Screen>
            <Stack.Screen name="EmployerTabs">
              {() => <EmployerTabs theme={currentTheme} setIsSignedIn={setIsSignedIn} />}
            </Stack.Screen>
            <Stack.Screen name="ManageGymDetails" component={ManageGymDetailsScreen} />
            <Stack.Screen name="ManageClasses" component={ManageClassesScreen} />
            <Stack.Screen name="AddClass" component={AddClassScreen} />
            <Stack.Screen name="GymDetail" component={GymDetailScreen} />
            <Stack.Screen name="EditGymInfo" component={EditGymInfoScreen} />
            <Stack.Screen name="EditEmployerInfo" component={EditEmployerInfoScreen} />
            <Stack.Screen name="EmployerPlanConfig" component={EmployerPlanConfigScreen} />
            <Stack.Screen name="EmployerManageEmployees" component={EmployerManageEmployeesScreen} />
            <Stack.Screen name="EditUserInfo" component={EditUserInfoScreen} />
            <Stack.Screen name="LinkCorporateAccount" component={LinkCorporateAccountScreen} />
            <Stack.Screen name="ChangeLoginData" component={ChangeLoginDataScreen} />
            <Stack.Screen name="GymReservations" component={GymReservationsScreen} />
            <Stack.Screen name="GymStats" component={GymStatsScreen} />
            <Stack.Screen name="ClassCalendar" component={ClassCalendarScreen} />
            <Stack.Screen name="QRScanner" component={QRScannerScreen} />
            <Stack.Screen name="CodeValidator" component={CodeValidatorScreen} />
            <Stack.Screen name="GymReports" component={GymReportsScreen} />
            <Stack.Screen name="GymReviews" component={GymReviewsScreen} />
            <Stack.Screen name="Map" component={MapScreen} />
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
