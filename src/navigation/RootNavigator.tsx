import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ArchiveScreen } from '../screens/ArchiveScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { ProcessInboxScreen } from '../screens/ProcessInboxScreen';
import { RealityScoreScreen } from '../screens/RealityScoreScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { RootStackParamList } from '../types';
import { Colors } from '../utils/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_right' as const,
  animationDuration: 220,
};

/** Auth screens use fade for a calmer feel */
const AUTH_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'fade' as const,
  animationDuration: 280,
};

/** Modal-like screens slide up from bottom */
const MODAL_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_bottom' as const,
  animationDuration: 250,
  presentation: 'modal' as const,
};

/** Detail screens slide from right (default) with iOS interactivity */
const DETAIL_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'ios_from_right' as const,
  animationDuration: 220,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
};

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.black} size="small" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Archive" component={ArchiveScreen} options={DETAIL_SCREEN_OPTIONS} />
            <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={DETAIL_SCREEN_OPTIONS} />
            <Stack.Screen name="ProcessInbox" component={ProcessInboxScreen} options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="RealityScore" component={RealityScoreScreen} options={MODAL_SCREEN_OPTIONS} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={DETAIL_SCREEN_OPTIONS} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={DETAIL_SCREEN_OPTIONS} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={AUTH_SCREEN_OPTIONS} />
            <Stack.Screen name="Register" component={RegisterScreen} options={AUTH_SCREEN_OPTIONS} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
});
