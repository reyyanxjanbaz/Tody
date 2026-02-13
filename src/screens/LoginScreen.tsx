import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography } from '../utils/colors';
import { Button } from '../components/Button';
import { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { login, error, isLoading, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = useCallback(async () => {
    await login(email, password);
  }, [email, password, login]);

  const handleNavigateRegister = useCallback(() => {
    clearError();
    navigation.navigate('Register');
  }, [clearError, navigation]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 60 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Tody</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.gray500}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.gray500}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          <Button
            title={isLoading ? 'Signing in...' : 'Sign in'}
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            style={styles.button}
          />
        </View>

        {/* Footer link */}
        <Pressable style={styles.linkContainer} onPress={handleNavigateRegister}>
          <Text style={styles.linkText}>
            {"Don't have an account? "}
            <Text style={styles.linkTextBold}>Register</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xxxxl,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.md,
  },
  errorContainer: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.gray800,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.gray800,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 2,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  button: {
    marginTop: Spacing.sm,
  },
  linkContainer: {
    marginTop: Spacing.xxxl,
    alignItems: 'center',
  },
  linkText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  linkTextBold: {
    fontWeight: '600',
    color: Colors.text,
  },
});
