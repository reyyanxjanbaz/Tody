import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { TaskProvider } from './src/context/TaskContext';
import { InboxProvider } from './src/context/InboxContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { UndoProvider } from './src/components/UndoToast';
import { RootNavigator } from './src/navigation/RootNavigator';

function AppContent(): React.JSX.Element {
  const { isDark, colors } = useTheme();
  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <AuthProvider>
        <TaskProvider>
          <InboxProvider>
            <UndoProvider>
              <RootNavigator />
            </UndoProvider>
          </InboxProvider>
        </TaskProvider>
      </AuthProvider>
    </>
  );
}

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
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
