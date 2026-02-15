import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AuthProvider } from './src/context/AuthContext';
import { TaskProvider } from './src/context/TaskContext';
import { InboxProvider } from './src/context/InboxContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { UndoProvider } from './src/components/UndoToast';
import { RootNavigator } from './src/navigation/RootNavigator';

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
