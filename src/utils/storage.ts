import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  TASKS: '@tody_tasks',
  INBOX_TASKS: '@tody_inbox_tasks',
  ARCHIVED_TASKS: '@tody_archived_tasks',
  CATEGORIES: '@tody_categories',
  ACTIVE_CATEGORY: '@tody_active_category',
  USER_PREFERENCES: '@tody_user_preferences',
  AVATAR_URI: '@tody_avatar_uri',
} as const;

export async function saveTasks(tasks: object[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
}

export async function getTasks<T>(): Promise<T[]> {
  const data = await AsyncStorage.getItem(KEYS.TASKS);
  return data ? JSON.parse(data) : [];
}
export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

export async function saveInboxTasks(tasks: object[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.INBOX_TASKS, JSON.stringify(tasks));
}

export async function getInboxTasks<T>(): Promise<T[]> {
  const data = await AsyncStorage.getItem(KEYS.INBOX_TASKS);
  return data ? JSON.parse(data) : [];
}

export async function saveArchivedTasks(tasks: object[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.ARCHIVED_TASKS, JSON.stringify(tasks));
}

export async function getArchivedTasks<T>(): Promise<T[]> {
  const data = await AsyncStorage.getItem(KEYS.ARCHIVED_TASKS);
  return data ? JSON.parse(data) : [];
}

// ── Profile / Preferences ────────────────────────────────────────────────

export async function saveUserPreferences(prefs: object): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER_PREFERENCES, JSON.stringify(prefs));
}

export async function getUserPreferences<T>(): Promise<T | null> {
  const data = await AsyncStorage.getItem(KEYS.USER_PREFERENCES);
  return data ? JSON.parse(data) : null;
}

export async function saveAvatarUri(uri: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.AVATAR_URI, uri);
}

export async function getAvatarUri(): Promise<string | null> {
  return await AsyncStorage.getItem(KEYS.AVATAR_URI);
}

// ── Categories ───────────────────────────────────────────────────────────

export async function saveCategories(categories: object[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
}

export async function getCategories<T>(): Promise<T[]> {
  const data = await AsyncStorage.getItem(KEYS.CATEGORIES);
  return data ? JSON.parse(data) : [];
}

export async function saveActiveCategory(categoryId: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.ACTIVE_CATEGORY, categoryId);
}

export async function getActiveCategory(): Promise<string | null> {
  return await AsyncStorage.getItem(KEYS.ACTIVE_CATEGORY);
}
