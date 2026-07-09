import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, Typography, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { EnergyLevel, Priority } from '../types';

interface TemplateTask {
  title: string;
  priority: Priority;
  energyLevel: EnergyLevel;
  estimatedMinutes?: number;
}

interface Template {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  tasks: TemplateTask[];
}

const TEMPLATES: Template[] = [
  {
    id: 'workday',
    title: 'Work Day',
    description: '5 tasks for a productive work day',
    icon: 'briefcase-outline',
    iconColor: '#EF4444',
    tasks: [
      { title: 'Check emails and prioritize inbox', priority: 'medium', energyLevel: 'low', estimatedMinutes: 15 },
      { title: 'Complete the most important project task', priority: 'high', energyLevel: 'high', estimatedMinutes: 90 },
      { title: 'Review and respond to team messages', priority: 'medium', energyLevel: 'medium', estimatedMinutes: 20 },
      { title: 'Plan tomorrow\'s priorities', priority: 'low', energyLevel: 'low', estimatedMinutes: 10 },
      { title: 'End-of-day status update', priority: 'low', energyLevel: 'low', estimatedMinutes: 10 },
    ],
  },
  {
    id: 'personal',
    title: 'Personal Goals',
    description: '4 tasks to improve daily life',
    icon: 'heart-outline',
    iconColor: '#22C55E',
    tasks: [
      { title: 'Morning workout or walk (30 min)', priority: 'high', energyLevel: 'high', estimatedMinutes: 30 },
      { title: 'Read for 20 minutes', priority: 'medium', energyLevel: 'medium', estimatedMinutes: 20 },
      { title: 'Meal prep or cook a healthy dinner', priority: 'medium', energyLevel: 'medium', estimatedMinutes: 45 },
      { title: 'Journal: 3 things I\'m grateful for', priority: 'low', energyLevel: 'low', estimatedMinutes: 5 },
    ],
  },
  {
    id: 'habits',
    title: 'Weekly Habits',
    description: '7 recurring items to build momentum',
    icon: 'repeat-outline',
    iconColor: '#F59E0B',
    tasks: [
      { title: 'Monday: Set weekly goals', priority: 'high', energyLevel: 'high', estimatedMinutes: 15 },
      { title: 'Tuesday: Deep work block (2 hours)', priority: 'high', energyLevel: 'high', estimatedMinutes: 120 },
      { title: 'Wednesday: Review progress', priority: 'medium', energyLevel: 'medium', estimatedMinutes: 15 },
      { title: 'Thursday: Learn something new', priority: 'medium', energyLevel: 'high', estimatedMinutes: 30 },
      { title: 'Friday: Week review & celebrate wins', priority: 'medium', energyLevel: 'low', estimatedMinutes: 15 },
      { title: 'Saturday: Organize workspace', priority: 'low', energyLevel: 'low', estimatedMinutes: 20 },
      { title: 'Sunday: Plan the week ahead', priority: 'high', energyLevel: 'medium', estimatedMinutes: 20 },
    ],
  },
];

interface ZeroStateOnboardingProps {
  onSelectTemplate: (tasks: TemplateTask[]) => void;
  onDismiss: () => void;
}

/**
 * Feature 7: Zero-State Onboarding
 * 
 * Three template cards: vertical stack, 12pt gap, 90% screen width, centered.
 * Card: 100pt height, white background, 1px border, black text.
 * 16pt bold title, 12pt gray description.
 */
export const ZeroStateOnboarding = memo(function ZeroStateOnboarding({
  onSelectTemplate,
  onDismiss,
}: ZeroStateOnboardingProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const handleSelectTemplate = useCallback(
    (template: Template) => {
      onSelectTemplate(template.tasks);
    },
    [onSelectTemplate],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Welcome illustration area */}
      <View style={styles.welcomeArea}>
        <Icon name="checkmark-done-outline" size={48} color={colors.text} />
        <Text style={styles.welcomeTitle}>Welcome to ToDy</Text>
        <Text style={styles.welcomeSubtitle}>
          Start with a template or create from scratch
        </Text>
      </View>

      {/* Template cards */}
      {TEMPLATES.map((template) => (
        <Pressable
          key={template.id}
          style={styles.card}
          onPress={() => handleSelectTemplate(template)}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: template.iconColor + '15' }]}>
              <Icon name={template.icon} size={22} color={template.iconColor} />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>{template.title}</Text>
              <Text style={styles.cardDescription}>{template.description}</Text>
            </View>
            <Icon name="arrow-forward" size={16} color={colors.gray400} />
          </View>
          {/* Preview of tasks */}
          <View style={styles.taskPreview}>
            {template.tasks.slice(0, 3).map((task, i) => (
              <View key={i} style={styles.previewItem}>
                <View style={styles.previewBullet} />
                <Text style={styles.previewText} numberOfLines={1}>{task.title}</Text>
              </View>
            ))}
            {template.tasks.length > 3 && (
              <Text style={styles.moreText}>
                +{template.tasks.length - 3} more
              </Text>
            )}
          </View>
        </Pressable>
      ))}

      {/* Create from scratch */}
      <Pressable style={styles.scratchButton} onPress={onDismiss}>
        <Text style={styles.scratchText}>Create from scratch</Text>
      </Pressable>
    </ScrollView>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  welcomeArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: c.text,
    marginTop: 16,
    fontFamily: FontFamily,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: c.gray500,
    marginTop: 6,
    fontFamily: FontFamily,
  },
  card: {
    width: '100%',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.gray200,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    fontFamily: FontFamily,
  },
  cardDescription: {
    fontSize: 12,
    color: c.gray500,
    marginTop: 2,
    fontFamily: FontFamily,
  },
  taskPreview: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.gray100,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.gray400,
    marginRight: 8,
  },
  previewText: {
    fontSize: 12,
    color: c.gray600,
    flex: 1,
    fontFamily: FontFamily,
  },
  moreText: {
    fontSize: 11,
    color: c.gray400,
    marginTop: 2,
    marginLeft: 12,
    fontFamily: FontFamily,
  },
  scratchButton: {
    marginTop: 8,
    paddingVertical: 12,
  },
  scratchText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textSecondary,
    fontFamily: FontFamily,
  },
});
