import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER: '@tody_user',
  TASKS: '@tody_tasks',
  SEARCH_HISTORY: '@tody_searches',
  INBOX_TASKS: '@tody_inbox_tasks',
  ARCHIVED_TASKS: '@tody_archived_tasks',
  TASK_PATTERNS: '@tody_task_patterns',
  ENERGY_FILTER: '@tody_energy_filter',
  CATEGORIES: '@tody_categories',
  ACTIVE_CATEGORY: '@tody_active_category',
  USER_PREFERENCES: '@tody_user_preferences',
  AVATAR_URI: '@tody_avatar_uri',
} as const;

export async function saveUser(user: object): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export async function getUser<T>(): Promise<T | null> {
  const data = await AsyncStorage.getItem(KEYS.USER);
  return data ? JSON.parse(data) : null;
}

export async function removeUser(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.USER);
}

export async function saveTasks(tasks: object[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
}

export async function getTasks<T>(): Promise<T[]> {
  const data = await AsyncStorage.getItem(KEYS.TASKS);
  return data ? JSON.parse(data) : [];
}
export async function saveEnergyFilter(filter: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.ENERGY_FILTER, filter);
}

export async function getEnergyFilter(): Promise<string | null> {
  return await AsyncStorage.getItem(KEYS.ENERGY_FILTER);
}
export async function saveSearchHistory(history: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.SEARCH_HISTORY, JSON.stringify(history.slice(0, 10)));
}

export async function getSearchHistory(): Promise<string[]> {
  const data = await AsyncStorage.getItem(KEYS.SEARCH_HISTORY);
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
