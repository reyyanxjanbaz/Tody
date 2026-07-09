import type { EnergyLevel, Priority } from '../types';

export interface TemplateTask {
  title: string;
  priority: Priority;
  energyLevel: EnergyLevel;
  estimatedMinutes: number;
}

export interface StarterTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  tasks: TemplateTask[];
}

/** One-tap starter bundles shown on a brand-new empty Home (ported from native). */
export const STARTER_TEMPLATES: StarterTemplate[] = [
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
      { title: "Plan tomorrow's priorities", priority: 'low', energyLevel: 'low', estimatedMinutes: 10 },
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
      { title: "Journal: 3 things I'm grateful for", priority: 'low', energyLevel: 'low', estimatedMinutes: 5 },
    ],
  },
  {
    id: 'habits',
    title: 'Weekly Habits',
    description: '7 items to build momentum',
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
