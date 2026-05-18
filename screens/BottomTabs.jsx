import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import HomeScreen from "./HomeScreen";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import ExploreScreen from './ExploreScreen';
import PassScreen from './PassScreen';       
import ProfileScreen from './ProfileScreen'; 
import MapScreen from "./MapScreen";


const Tab = createBottomTabNavigator();

export default function BottomTabs({ theme, setIsSignedIn }) {
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
      <Tab.Screen name="HomeTab" component={HomeScreen}
        options={{ tabBarLabel: 'Inicio', tabBarIcon: ({ color }) => <Ionicons name="home-outline" color={color} size={24} /> }} />
            <Tab.Screen
        name="MapTab"
        component={MapScreen}
        options={{
          tabBarLabel: 'Explorar',
          tabBarIcon: ({ color }) => (
            <Ionicons name="map-outline" color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen name="PassTab" component={PassScreen}
        options={{ tabBarLabel: 'Mi Pase', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="qrcode" color={color} size={24} /> }} />
      <Tab.Screen name="ProfileTab"
        options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <Ionicons name="person-outline" color={color} size={24} /> }}>
          {props => <ProfileScreen {...props} setIsSignedIn={setIsSignedIn} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}