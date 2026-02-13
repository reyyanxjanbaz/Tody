import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER: '@tody_user',
  TASKS: '@tody_tasks',
  SEARCH_HISTORY: '@tody_searches',
  INBOX_TASKS: '@tody_inbox_tasks',
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
