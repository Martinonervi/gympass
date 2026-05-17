import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import EmployerHomeScreen from "./EmployerHomeScreen";
import ProfileScreen from "./ProfileScreen";

const Tab = createBottomTabNavigator();

export default function EmployerTabs({ theme, setIsSignedIn }) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceVariant,
          borderTopWidth: 0,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 12, marginBottom: 4 },
      }}
    >
      <Tab.Screen
        name="EmployerHomeTab"
        component={EmployerHomeScreen}
        options={{
          tabBarLabel: "Inicio",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="EmployerProfileTab"
        options={{
          tabBarLabel: "Perfil",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" color={color} size={24} />
          ),
        }}
      >
        {(props) => (
          <ProfileScreen {...props} setIsSignedIn={setIsSignedIn} />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
