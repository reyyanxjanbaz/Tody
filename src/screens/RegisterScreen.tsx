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
import { Colors, Spacing, Typography, BorderRadius } from '../utils/colors';
import { Button } from '../components/Button';
import { AnimatedPressable } from '../components/ui';
import { haptic } from '../utils/haptics';
import { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

export function RegisterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { register, error, isLoading, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  // ── Error shake ────────────────────────────────────────────────────────
  const errorShake = useSharedValue(0);

  useEffect(() => {
    if (displayError) {
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
  }, [displayError, errorShake]);

  const errorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: errorShake.value }],
  }));

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleRegister = useCallback(async () => {
    setLocalError(null);
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    await register(email, password);
  }, [email, password, confirmPassword, register]);

  const handleNavigateLogin = useCallback(() => {
    clearError();
    setLocalError(null);
    navigation.goBack();
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
          <Text style={styles.title}>Create{'\n'}Account</Text>
        </Animated.View>

        {/* Form – staggered entry */}
        <View style={styles.form}>
          {displayError ? (
            <Animated.View
              entering={FadeInDown.duration(250)}
              style={[styles.errorContainer, errorAnimatedStyle]}>
              <Text style={styles.errorText}>{displayError}</Text>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInDown.delay(100).duration(300)}>
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
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(160).duration(300)}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.gray500}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(220).duration(300)}>
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor={Colors.gray500}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(280).duration(300)}>
            <Button
              title={isLoading ? 'Creating account...' : 'Create account'}
              onPress={handleRegister}
              loading={isLoading}
              disabled={isLoading}
              style={styles.button}
            />
          </Animated.View>
        </View>

        {/* Footer link – slides up */}
        <Animated.View
          entering={FadeInUp.delay(380).duration(350)}>
          <AnimatedPressable
            style={styles.linkContainer}
            onPress={handleNavigateLogin}
            hapticStyle="light">
            <Text style={styles.linkText}>
              {'Already have an account? '}
              <Text style={styles.linkTextBold}>Sign in</Text>
            </Text>
          </AnimatedPressable>
        </Animated.View>
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
    lineHeight: 44,
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
    height: 56,
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.xl,
    ...Typography.body,
    color: Colors.text,
    backgroundColor: '#F2F2F7',
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
