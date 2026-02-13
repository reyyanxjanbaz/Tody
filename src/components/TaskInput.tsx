import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Spacing, Typography } from '../utils/colors';
import { parseEstimateInput, formatMinutes } from '../utils/timeTracking';
import { EstimateSuggestion } from './EstimateSuggestion';
import { EnergyLevel } from '../types';
import { EnergySelector } from './EnergySelector';
import { SmartKeyboardToolbar } from './SmartKeyboardToolbar';
import { AnimatedPressable } from './ui';
import { haptic } from '../utils/haptics';
import { SPRING_SNAPPY } from '../utils/animations';

interface TaskInputProps {
  onSubmit: (text: string, estimatedMinutes?: number, energyLevel?: EnergyLevel) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const TaskInput = memo(function TaskInput({ onSubmit, placeholder, autoFocus }: TaskInputProps) {
  const [value, setValue] = useState('');
  const [estimateText, setEstimateText] = useState('');
  const [showEstimate, setShowEstimate] = useState(false);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('medium');
  const [hasManuallySetEnergy, setHasManuallySetEnergy] = useState(false);
  const [activeField, setActiveField] = useState<'title' | 'estimate' | null>(null);

  const inputRef = useRef<TextInput>(null);
  const estimateInputRef = useRef<TextInput>(null);

  const parsedEstimate = estimateText ? parseEstimateInput(estimateText) : null;

  const suggestEnergy = useCallback((text: string) => {
    const lower = text.toLowerCase();
    if (lower.match(/write|design|plan|strategy/)) return 'high';
    if (lower.match(/call|email|review|check/)) return 'medium';
    if (lower.match(/respond|forward|pay|buy/)) return 'low';
    return null;
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) { return; }
    const minutes = estimateText ? parseEstimateInput(estimateText) : undefined;
    onSubmit(trimmed, minutes ?? undefined, energyLevel);
    setValue('');
    setEstimateText('');
    setEnergyLevel('medium');
    setHasManuallySetEnergy(false);
    setShowEstimate(false);
  }, [value, estimateText, onSubmit, energyLevel]);

  const handleTitleChange = useCallback((text: string) => {
    setValue(text);
    if (text.trim().length > 0 && !showEstimate) {
      setShowEstimate(true);
    } else if (text.trim().length === 0) {
      setShowEstimate(false);
      setEstimateText('');
    }

    if (!hasManuallySetEnergy) {
      const suggestion = suggestEnergy(text);
      if (suggestion) {
        setEnergyLevel(suggestion);
      }
    }
  }, [showEstimate, hasManuallySetEnergy, suggestEnergy]);

  const handleEnergyChange = useCallback((level: EnergyLevel) => {
    setEnergyLevel(level);
    setHasManuallySetEnergy(true);
  }, []);

  return (
    <Animated.View layout={LinearTransition.duration(250)}>
      <View style={styles.container}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder || 'Add a task... try "buy milk tomorrow"'}
          placeholderTextColor={Colors.gray400}
          value={value}
          onChangeText={handleTitleChange}
          onFocus={() => setActiveField('title')}
          onBlur={() => setActiveField(null)}
          onSubmitEditing={() => {
            if (showEstimate && !estimateText) {
              estimateInputRef.current?.focus();
            } else {
              handleSubmit();
            }
          }}
          returnKeyType={showEstimate && !estimateText ? 'next' : 'done'}
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize="sentences"
          autoFocus={autoFocus}
        />
        {value.trim().length > 0 && (
          <AnimatedPressable
            onPress={() => { haptic('light'); handleSubmit(); }}
            hapticStyle={null}
            pressScale={0.9}>
            <View style={styles.addButton}>
              <Text style={styles.addButtonText}>+</Text>
            </View>
          </AnimatedPressable>
        )}
      </View>
      {showEstimate && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          exiting={FadeOutUp.duration(200)}>
          <View style={styles.estimateRow}>
            <TextInput
              ref={estimateInputRef}
              style={styles.estimateInput}
              placeholder="30 minutes"
              placeholderTextColor={Colors.gray400}
              value={estimateText}
              onChangeText={setEstimateText}
              onFocus={() => setActiveField('estimate')}
              onBlur={() => setActiveField(null)}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              blurOnSubmit={false}
              keyboardType="default"
              autoCorrect={false}
            />
            {parsedEstimate != null && (
              <Text style={styles.estimateParsed}>
                {formatMinutes(parsedEstimate)}
              </Text>
            )}
          </View>
          <View style={styles.energySelectorWrapper}>
            <EnergySelector value={energyLevel} onChange={handleEnergyChange} />
          </View>
        </Animated.View>
      )}
      <EstimateSuggestion
        taskTitle={value}
        userEstimateMinutes={parsedEstimate}
      />
      {/* Feature 5: Smart Keyboard Toolbar */}
      <SmartKeyboardToolbar
        mode={activeField === 'estimate' ? 'estimate' : 'title'}
        visible={!!activeField && value.trim().length > 0}
        onInsertPriority={() => { }}
        onInsertEnergy={(energy) => {
          setEnergyLevel(energy);
          setHasManuallySetEnergy(true);
        }}
        onAddTime={(minutes) => {
          setEstimateText(String(minutes));
        }}
      />
    </Animated.View>
  );
});

const selectorStyles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  label: {
    ...Typography.caption,
    color: Colors.gray600,
    marginBottom: Spacing.xs,
  },
  buttons: {
    flexDirection: 'row',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.black,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRightWidth: 1,
    borderRightColor: Colors.black,
  },
  buttonSelected: {
    backgroundColor: Colors.black,
  },
  buttonText: {
    ...Typography.caption,
    color: Colors.black,
    fontWeight: '400',
  },
  buttonTextSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
});


const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface, // Softer background
    borderRadius: 12, // Rounded corners
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 56, // Slightly taller
    // Shadow for depth
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  input: {
    flex: 1,
    height: '100%',
    ...Typography.body,
    fontSize: 16,
    color: Colors.text,
  },
  addButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.black,
    borderRadius: 18,
    marginLeft: Spacing.sm,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
    marginTop: -2,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  estimateInput: {
    flex: 1,
    height: 36,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  estimateParsed: {
    fontSize: 11,
    color: Colors.gray500,
    marginLeft: Spacing.sm,
  },
  energySelectorWrapper: {
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    paddingBottom: Spacing.sm,
  },
});
