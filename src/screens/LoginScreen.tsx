import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';
import { AnimatedPressable } from '../components/ui';
import { haptic } from '../utils/haptics';
import { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { login, error, isLoading, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ── Error shake ────────────────────────────────────────────────────────
  const errorShake = useSharedValue(0);

  useEffect(() => {
    if (error) {
      haptic('error');
      errorShake.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-3, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [error, errorShake]);

  const errorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: errorShake.value }],
  }));

  // ── Handlers ───────────────────────────────────────────────────────────
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
        {/* Header – staggered entry */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={styles.header}>
          <Text style={styles.title}>ToDy</Text>
          <Animated.Text
            entering={FadeInDown.delay(80).duration(350)}
            style={styles.subtitle}>
            Sign in to continue
          </Animated.Text>
        </Animated.View>

        {/* Form – staggered entry */}
        <View style={styles.form}>
          {error ? (
            <Animated.View
              entering={FadeInDown.duration(250)}
              style={[styles.errorContainer, errorAnimatedStyle]}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInDown.delay(120).duration(300)}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.gray500}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(180).duration(300)}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.gray500}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(240).duration(300)}>
            <Button
              title={isLoading ? 'Signing in...' : 'Sign in'}
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              style={styles.button}
            />
          </Animated.View>
        </View>

        {/* Footer link – slides up */}
        <Animated.View
          entering={FadeInUp.delay(350).duration(350)}>
          <AnimatedPressable
            style={styles.linkContainer}
            onPress={handleNavigateRegister}
            hapticStyle="light">
            <Text style={styles.linkText}>
              {"Don't have an account? "}
              <Text style={styles.linkTextBold}>Register</Text>
            </Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
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
    color: c.text,
    fontFamily: FontFamily,
  },
  subtitle: {
    ...Typography.caption,
    color: c.textTertiary,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.md,
  },
  errorContainer: {
    borderLeftWidth: 2,
    borderLeftColor: c.gray800,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    ...Typography.caption,
    color: c.gray800,
  },
  input: {
    height: 56,
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.xl,
    ...Typography.body,
    color: c.text,
    backgroundColor: c.gray50,
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
    color: c.textTertiary,
  },
  linkTextBold: {
    fontWeight: '600',
    color: c.text,
  },
});
