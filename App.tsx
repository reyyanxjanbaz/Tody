import React, { useEffect } from 'react';
import { StyleSheet, Text, TextInput, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AuthProvider } from './src/context/AuthContext';
import { TaskProvider } from './src/context/TaskContext';
import { InboxProvider } from './src/context/InboxContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { UndoProvider } from './src/components/UndoToast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { FontFamily } from './src/utils/colors';

// ── Global font default for Android ─────────────────────────────────────────
// Ensures every <Text> and <TextInput> uses our custom font even if
// fontFamily isn't explicitly set in the component's style.
if (Platform.OS === 'android') {
  const originalTextRender = (Text as any).render;
  if (originalTextRender) {
    (Text as any).render = function (props: any, ref: any) {
      const style = [{ fontFamily: FontFamily }, props.style];
      return originalTextRender.call(this, { ...props, style }, ref);
    };
  }

  const originalInputRender = (TextInput as any).render;
  if (originalInputRender) {
    (TextInput as any).render = function (props: any, ref: any) {
      const style = [{ fontFamily: FontFamily }, props.style];
      return originalInputRender.call(this, { ...props, style }, ref);
    };
  }
}

function App(): React.JSX.Element {
  useEffect(() => {
    Ionicons.loadFont();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <TaskProvider>
              <InboxProvider>
                <UndoProvider>
                  <RootNavigator />
                </UndoProvider>
              </InboxProvider>
            </TaskProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
