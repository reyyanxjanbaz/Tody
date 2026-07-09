/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('react-native-vector-icons/Ionicons', () => ({
  loadFont: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('../src/context/AuthContext', () => {
  const React = require('react');
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('../src/context/TaskContext', () => {
  const React = require('react');
  return {
    TaskProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('../src/context/InboxContext', () => {
  const React = require('react');
  return {
    InboxProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('../src/context/ThemeContext', () => {
  const React = require('react');
  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('../src/components/UndoToast', () => {
  const React = require('react');
  return {
    UndoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('../src/navigation/RootNavigator', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    RootNavigator: () => <Text>Root Navigator</Text>,
  };
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
